// The chat UI - a small React app (JSX is compiled in the browser by Babel).
const { useState, useRef, useEffect } = React;

const SUGGESTIONS = [
  "How long can I return headphones?",
  "Do loyalty points expire?",
  "What are the Platinum benefits?",
  "How much is express delivery?",
];

function Sources({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  return (
    <div className="sources">
      <button className="link" onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"} {sources.length} sources
      </button>
      {open && (
        <ol>
          {sources.map((s, i) => (
            <li key={i}>
              <div className="source-head">
                <strong>{s.heading}</strong>
                <span className="score">score {s.score.toFixed(3)}</span>
              </div>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Documents() {
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then((d) => setDocs(d.documents));
  }, []);

  async function call(url, options, doneText) {
    setBusy(true);
    setStatus("Indexing…");
    try {
      const res = await fetch(url, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocs(data.documents);
      setStatus(`${doneText} · ${data.stats.chunks} chunks indexed`);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  function upload(e) {
    const file = e.target.files[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    call(`/api/documents?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file }, `Added ${file.name}`);
  }

  function remove(name) {
    if (!confirm(`Remove ${name}?`)) return;
    call(`/api/documents?name=${encodeURIComponent(name)}`, { method: "DELETE" }, `Removed ${name}`);
  }

  return (
    <div className="docs">
      <div className="docs-bar">
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} documents ({docs.length})
        </button>
        <button className="upload" onClick={() => fileRef.current.click()} disabled={busy}>
          {busy ? "Indexing…" : "Upload PDF / Word / text"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={upload} />
      </div>
      {status && <div className="docs-status">{status}</div>}
      {open && (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d}>
              <span>{d}</span>
              <button className="link danger" onClick={() => remove(d)} disabled={busy}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Message({ msg }) {
  return (
    <div className={`msg ${msg.role}`}>
      <div className="bubble">
        {msg.error ? <span className="error">{msg.content}</span> : msg.content}
        {msg.role === "assistant" && <Sources sources={msg.sources} />}
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(question) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Mini Copilot</h1>
        <span className="sub">Answers from your documents</span>
      </header>
      <Documents />

      <main className="chat">
        {messages.length === 0 && (
          <div className="empty">
            <p>Ask about the sample Acme Store docs, or upload your own PDF or Word file above.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && <div className="msg assistant"><div className="bubble thinking">Searching documents…</div></div>}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>Send</button>
      </form>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
