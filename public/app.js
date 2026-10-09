// The chat UI - a small React app (JSX is compiled in the browser by Babel).
const { useState, useRef, useEffect } = React;

// fetch + JSON that never crashes on an HTML/text error page
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server returned ${res.status}: ${text.slice(0, 80)}`);
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

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
  const [uploadMode, setUploadMode] = useState("disabled"); // "supabase" | "local" | "disabled"
  const fileRef = useRef(null);
  const uploadsEnabled = uploadMode !== "disabled";

  useEffect(() => {
    fetchJson("/api/documents")
      .then((d) => {
        setDocs(d.documents);
        setUploadMode(d.uploadMode);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  async function run(work) {
    setBusy(true);
    try {
      const data = await work();
      setDocs(data.documents);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }

  const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  function upload(e) {
    const file = e.target.files[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setStatus("File is larger than 10 MB");

    run(async () => {
      let data;
      if (uploadMode === "supabase") {
        // 1. get a one-time upload URL  2. send the file straight to Supabase  3. ask the server to index it
        setStatus(`Uploading ${file.name}…`);
        const { name, uploadUrl } = await fetchJson("/api/upload-url", json({ name: file.name }));
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status}): ${(await put.text()).slice(0, 80)}`);
        setStatus(`Indexing ${name}…`);
        data = await fetchJson("/api/index-document", json({ name }));
      } else {
        setStatus(`Indexing ${file.name}…`);
        data = await fetchJson(`/api/documents?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      }
      setStatus(`Added ${data.indexed.name} · ${data.indexed.chunks} chunks`);
      return data;
    });
  }

  function remove(name) {
    if (!confirm(`Remove ${name}?`)) return;
    run(async () => {
      const data = await fetchJson(`/api/documents?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      setStatus(`Removed ${name}`);
      return data;
    });
  }

  return (
    <div className="docs">
      <div className="docs-bar">
        <button className="link" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} documents ({docs.length})
        </button>
        {uploadsEnabled ? (
          <button className="upload" onClick={() => fileRef.current.click()} disabled={busy}>
            {busy ? "Indexing…" : "Upload PDF / Word / text"}
          </button>
        ) : (
          <span className="docs-status">Demo mode: uploads need Supabase (see README)</span>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={upload} />
      </div>
      {status && <div className="docs-status">{status}</div>}
      {open && (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d}>
              <span>{d}</span>
              {uploadsEnabled && (
                <button className="link danger" onClick={() => remove(d)} disabled={busy}>Remove</button>
              )}
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
      const data = await fetchJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
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
