// Mini Copilot UI - a small React app (JSX is compiled in the browser by Babel).
const { useState, useRef, useEffect, useCallback } = React;

/* ---------- helpers ---------- */

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

const postJson = (url, body) =>
  fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Browser storage can be blocked (private mode), so never let it throw
const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const MAX_UPLOAD_MB = 10;
const ACCEPT = ".pdf,.docx,.txt,.md";

// Markdown -> safe HTML, with citation markers ([1] or 【1】) turned into clickable chips.
// DOMPurify removes any script/HTML that could have come from a document or the model.
function renderAnswer(text) {
  const withCites = text.replace(/【(\d+)】|\[(\d+)\]/g, (_, a, b) => `<sup class="cite" data-n="${a || b}">${a || b}</sup>`);
  return DOMPurify.sanitize(marked.parse(withCites, { breaks: true }));
}

const fileExt = (name) => (name.split(".").pop() || "").toLowerCase();

/* ---------- icons (inline SVG, Lucide-style) ---------- */

const ICON_PATHS = {
  sparkles: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z",
  plus: "M12 5v14M5 12h14",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  trash: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
  send: "M5 12h14M13 6l6 6-6 6",
  menu: "M3 6h18M3 12h18M3 18h18",
  x: "M18 6 6 18M6 6l12 12",
  copy: "M8 8h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3",
  check: "M20 6 9 17l-5-5",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5V21h16",
  external: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3",
  alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  sun: "M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

function Logo({ size = 28 }) {
  return (
    <span className="logo" style={{ width: size, height: size }}>
      <Icon name="sparkles" size={size * 0.58} />
    </span>
  );
}

function FileBadge({ name }) {
  const ext = fileExt(name);
  return <span className={`file-badge ext-${ext}`}>{ext === "docx" ? "DOC" : ext.toUpperCase()}</span>;
}

/* ---------- theme: light / dark / system ---------- */

// "system" removes the attribute so the CSS follows the OS setting (prefers-color-scheme)
function applyTheme(theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => storage.get("mini-copilot:theme") || "system");

  useEffect(() => {
    applyTheme(theme);
    storage.set("mini-copilot:theme", theme);
  }, [theme]);

  const options = [
    { id: "light", icon: "sun", label: "Light theme" },
    { id: "dark", icon: "moon", label: "Dark theme" },
    { id: "system", icon: "monitor", label: "Match system theme" },
  ];
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={theme === o.id} aria-label={o.label} title={o.label}
          className={theme === o.id ? "active" : ""} onClick={() => setTheme(o.id)}>
          <Icon name={o.icon} size={15} />
        </button>
      ))}
    </div>
  );
}

/* ---------- documents (state + upload logic) ---------- */

function useDocuments() {
  const [docs, setDocs] = useState([]);
  const [uploadMode, setUploadMode] = useState("disabled"); // "supabase" | "local" | "disabled"
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "info" | "success" | "error", text }

  useEffect(() => {
    fetchJson("/api/documents")
      .then((d) => { setDocs(d.documents); setUploadMode(d.uploadMode); })
      .catch((err) => setNotice({ type: "error", text: err.message }));
  }, []);

  async function run(work) {
    setBusy(true);
    try {
      const data = await work();
      setDocs(data.documents);
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const upload = (file) => {
    if (!file || busy || uploadMode === "disabled") return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return setNotice({ type: "error", text: `${file.name} is larger than ${MAX_UPLOAD_MB} MB` });
    }
    run(async () => {
      let data;
      if (uploadMode === "supabase") {
        // 1. one-time upload URL  2. file goes straight to Supabase Storage  3. server indexes it
        setNotice({ type: "info", text: `Uploading ${file.name}…` });
        const { name, uploadUrl } = await postJson("/api/upload-url", { name: file.name });
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        setNotice({ type: "info", text: `Reading and indexing ${name}…` });
        data = await postJson("/api/index-document", { name });
      } else {
        setNotice({ type: "info", text: `Reading and indexing ${file.name}…` });
        data = await fetchJson(`/api/documents?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file });
      }
      setNotice({ type: "success", text: `Added ${data.indexed.name} · ${data.indexed.chunks} chunks` });
      return data;
    });
  };

  const remove = (name) => {
    if (!confirm(`Remove "${name}" from the knowledge base?`)) return;
    run(async () => {
      const data = await fetchJson(`/api/documents?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      setNotice({ type: "success", text: `Removed ${name}` });
      return data;
    });
  };

  return { docs, uploadMode, canEdit: uploadMode !== "disabled", busy, notice, setNotice, upload, remove };
}

/* ---------- sidebar ---------- */

function Sidebar({ documents, open, onClose, onNewChat }) {
  const { docs, canEdit, busy, notice, setNotice, upload, remove } = documents;
  const fileRef = useRef(null);

  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-head">
          <div className="brand">
            <Logo />
            <div>
              <div className="brand-name">Mini Copilot</div>
              <div className="brand-tag">Document Q&amp;A</div>
            </div>
          </div>
          <button className="icon-btn only-mobile" onClick={onClose} aria-label="Close menu"><Icon name="x" /></button>
        </div>

        <button className="new-chat" onClick={onNewChat}>
          <Icon name="plus" size={16} /> New chat
        </button>

        <div className="section-label">
          <span>Knowledge base</span>
          <span className="count">{docs.length}</span>
        </div>

        {canEdit ? (
          <button className={`dropzone ${busy ? "busy" : ""}`} onClick={() => fileRef.current.click()} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="upload" size={18} />}
            <span className="dz-title">{busy ? "Processing…" : "Upload a document"}</span>
            <span className="dz-hint">PDF, Word, TXT, MD · max {MAX_UPLOAD_MB} MB · or drop anywhere</span>
          </button>
        ) : (
          <div className="readonly-note"><Icon name="lock" size={14} /> Uploads are turned off on this deployment.</div>
        )}
        <input ref={fileRef} type="file" accept={ACCEPT} hidden
          onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />

        {notice && (
          <div className={`notice ${notice.type}`} role="status">
            <Icon name={notice.type === "error" ? "alert" : notice.type === "success" ? "check" : "upload"} size={14} />
            <span>{notice.text}</span>
            <button className="notice-close" onClick={() => setNotice(null)} aria-label="Dismiss"><Icon name="x" size={12} /></button>
          </div>
        )}

        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d} title={d}>
              <FileBadge name={d} />
              <span className="doc-name">{d}</span>
              {canEdit && (
                <button className="icon-btn doc-remove" onClick={() => remove(d)} disabled={busy} aria-label={`Remove ${d}`}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </li>
          ))}
          {docs.length === 0 && <li className="empty-docs">No documents yet</li>}
        </ul>

        <div className="sidebar-foot">
          <span>RAG · pgvector · Groq</span>
          <a href="https://github.com/Pavithravignesh/mini-copilot" target="_blank" rel="noreferrer">
            GitHub <Icon name="external" size={12} />
          </a>
        </div>
      </aside>
    </>
  );
}

/* ---------- messages ---------- */

function SourceList({ sources, active, onSelect }) {
  if (!sources?.length) return null;
  return (
    <div className="sources">
      <div className="sources-label"><Icon name="book" size={13} /> Sources</div>
      <div className="source-chips">
        {sources.map((s, i) => (
          <button key={i} className={`source-chip ${active === i + 1 ? "active" : ""}`}
            onClick={() => onSelect(active === i + 1 ? null : i + 1)}>
            <span className="source-n">{i + 1}</span>
            <span className="source-doc">{s.source}</span>
          </button>
        ))}
      </div>
      {active && sources[active - 1] && (
        <div className="source-card">
          <div className="source-card-head">
            <FileBadge name={sources[active - 1].source} />
            <span className="source-heading">{sources[active - 1].heading}</span>
            <span className="relevance" title="Cosine similarity between the question and this chunk">
              <span className="relevance-bar"><span style={{ width: `${Math.max(4, Math.min(100, sources[active - 1].score * 100))}%` }} /></span>
              {sources[active - 1].score.toFixed(2)}
            </span>
          </div>
          <p>{sources[active - 1].text}</p>
        </div>
      )}
    </div>
  );
}

function AssistantMessage({ msg, models }) {
  const [activeSource, setActiveSource] = useState(null);
  const [copied, setCopied] = useState(false);
  const label = models.find((m) => m.id === msg.model)?.label ?? msg.model;

  // Clicking a [n] chip in the answer opens that source
  function onAnswerClick(e) {
    const cite = e.target.closest(".cite");
    if (cite) setActiveSource(Number(cite.dataset.n));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="msg assistant">
      <Logo size={30} />
      <div className="msg-body">
        {msg.error ? (
          <div className="error-box"><Icon name="alert" size={16} /> {msg.content}</div>
        ) : (
          <>
            <div className="answer" onClick={onAnswerClick} dangerouslySetInnerHTML={{ __html: renderAnswer(msg.content) }} />
            <SourceList sources={msg.sources} active={activeSource} onSelect={setActiveSource} />
            <div className="msg-actions">
              <button className="icon-btn small" onClick={copy} aria-label="Copy answer" title="Copy answer">
                <Icon name={copied ? "check" : "copy"} size={14} />
              </button>
              {msg.model && (
                <span className="meta">
                  {label} · {msg.seconds.toFixed(1)}s{msg.tokens ? ` · ${msg.tokens.toLocaleString()} tokens` : ""}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Thinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStep(1), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="msg assistant">
      <Logo size={30} />
      <div className="msg-body thinking">
        <span className="dots"><i /><i /><i /></span>
        {step === 0 ? "Searching your documents" : "Writing the answer"}
      </div>
    </div>
  );
}

/* ---------- composer ---------- */

function Composer({ onSend, loading, models, model, onModel }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  // grow with the text, up to a limit (empty = one row, set by CSS)
  useEffect(() => {
    const el = ref.current;
    el.style.height = "";
    if (text) el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    el.style.overflowY = el.scrollHeight > 200 ? "auto" : "hidden";
  }, [text]);

  function submit() {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Ask anything about your documents…"
          autoFocus
        />
        <div className="composer-bar">
          {models.length > 1 ? (
            <select className="model-select" value={model} onChange={(e) => onModel(e.target.value)} disabled={loading}
              title={models.find((m) => m.id === model)?.note} aria-label="Model">
              {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          ) : <span />}
          <button type="submit" className="send-btn" disabled={loading || !text.trim()} aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        </div>
      </form>
      <div className="disclaimer">Answers come only from your documents and include citations. Check important details.</div>
    </div>
  );
}

/* ---------- app ---------- */

const SUGGESTIONS = [
  { title: "Return window", q: "How long can I return headphones?" },
  { title: "Loyalty points", q: "Do loyalty points expire?" },
  { title: "Membership tiers", q: "What are the Platinum benefits?" },
  { title: "Delivery options", q: "How much is express delivery?" },
];

function App() {
  const documents = useDocuments();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchJson("/api/models")
      .then((d) => {
        setModels(d.models);
        const saved = storage.get("mini-copilot:model");
        setModel(d.models.some((m) => m.id === saved) ? saved : d.default);
      })
      .catch(() => {}); // no picker: the server uses its default model
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function chooseModel(id) {
    setModel(id);
    storage.set("mini-copilot:model", id);
  }

  async function send(question) {
    if (loading) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const data = await postJson("/api/chat", { question, model: model || undefined });
      setMessages((m) => [...m, {
        role: "assistant", content: data.answer, sources: data.sources,
        model: data.model, seconds: data.seconds, tokens: data.tokens,
      }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: err.message, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    setMessages([]);
    setSidebarOpen(false);
  }

  // Drag a file anywhere onto the window to upload it
  const onDragOver = useCallback((e) => {
    if (!documents.canEdit || !e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(true);
  }, [documents.canEdit]);

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) documents.upload(e.dataTransfer.files[0]);
  }

  return (
    <div className="layout" onDragOver={onDragOver} onDragLeave={(e) => { if (!e.relatedTarget) setDragging(false); }} onDrop={onDrop}>
      <Sidebar documents={documents} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={newChat} />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <span className="topbar-title">{messages.length ? "Chat" : ""}</span>
          <div className="topbar-actions">
            {messages.length > 0 && (
              <button className="ghost-btn" onClick={newChat}><Icon name="plus" size={15} /> New chat</button>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="scroll">
          <div className="thread">
            {messages.length === 0 ? (
              <div className="welcome">
                <Logo size={52} />
                <h1>What would you like to know?</h1>
                <p>
                  Ask questions about the {documents.docs.length} document{documents.docs.length === 1 ? "" : "s"} in your
                  knowledge base. Every answer cites the passages it used.
                </p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.q} className="suggestion" onClick={() => send(s.q)}>
                      <span className="suggestion-title">{s.title}</span>
                      <span className="suggestion-q">{s.q}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) =>
                msg.role === "user"
                  ? <div key={i} className="msg user"><div className="user-bubble">{msg.content}</div></div>
                  : <AssistantMessage key={i} msg={msg} models={models} />,
              )
            )}
            {loading && <Thinking />}
            <div ref={bottomRef} />
          </div>
        </div>

        <Composer onSend={send} loading={loading} models={models} model={model} onModel={chooseModel} />
      </main>

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-card"><Icon name="upload" size={28} /><span>Drop to add to your knowledge base</span></div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
