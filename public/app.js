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

const postJson = (url, body, signal) =>
  fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });

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
  chevronDown: "M6 9l6 6 6-6",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  quiz: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  arrowLeft: "M19 12H5M11 18l-6-6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  briefcase: "M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18",
  refresh: "M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  cpu: "M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 9h6v6H9z",
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
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "info" | "success" | "error", text }

  useEffect(() => {
    fetchJson("/api/documents")
      .then((d) => { setDocs(d.documents); setUploadMode(d.uploadMode); })
      .catch((err) => setNotice({ type: "error", text: err.message }))
      .finally(() => setLoaded(true));
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
      topicsCache.delete(data.indexed.name); // new content: suggest topics afresh
      setNotice({ type: "success", text: `Added ${data.indexed.name} · ${data.indexed.chunks} chunks` });
      return data;
    });
  };

  const remove = (name) => {
    if (!confirm(`Remove "${name}" from the knowledge base?`)) return;
    run(async () => {
      const data = await fetchJson(`/api/documents?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      topicsCache.delete(name);
      setNotice({ type: "success", text: `Removed ${name}` });
      return data;
    });
  };

  return { docs, loaded, uploadMode, canEdit: uploadMode !== "disabled", busy, notice, setNotice, upload, remove };
}

/* ---------- chat history (saved in this browser only) ---------- */

const HISTORY_KEY = "mini-copilot:chats";
const MAX_CHATS = 30;

function loadChats() {
  try {
    const chats = JSON.parse(storage.get(HISTORY_KEY) || "[]");
    return Array.isArray(chats) ? chats : [];
  } catch {
    return [];
  }
}

function saveChats(chats) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(chats));
  } catch {
    // storage full or blocked: keep the most recent half and try once more
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(chats.slice(0, Math.ceil(chats.length / 2)))); } catch {}
  }
}

const newChatId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "Yesterday";
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function RecentChats({ chats, currentId, onOpen, onDelete }) {
  if (chats.length === 0) return null;
  return (
    <>
      <div className="section-label"><span>Recent chats</span></div>
      <ul className="chat-list">
        {chats.map((c) => (
          <li key={c.id} className={c.id === currentId ? "active" : ""}>
            <button className="chat-item" onClick={() => onOpen(c.id)} title={c.title}>
              <span className="chat-title">{c.title}</span>
              <span className="chat-time">{timeAgo(c.updatedAt)}</span>
            </button>
            <button className="icon-btn doc-remove" onClick={() => onDelete(c.id)} aria-label={`Delete chat: ${c.title}`}>
              <Icon name="trash" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- sidebar ---------- */

function Sidebar({ documents, open, onClose, onNewChat, history }) {
  const { docs, loaded, canEdit, busy, notice, setNotice, upload, remove } = documents;
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

        <RecentChats {...history} />

        <div className="section-label">
          <span>Knowledge base</span>
          <span className="count">{docs.length}</span>
        </div>

        {!loaded ? (
          <div className="dropzone skeleton-box" aria-busy="true" />
        ) : canEdit ? (
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
          {!loaded && [0, 1, 2].map((i) => <li key={i} className="doc-skeleton" aria-hidden="true" />)}
          {loaded && docs.length === 0 && <li className="empty-docs">No documents yet</li>}
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

/* ---------- model menu ---------- */

// A custom dropdown: pill button + popover card listing each model with its description
function ModelMenu({ models, value, onChange, disabled, placement = "up" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = models.find((m) => m.id === value) ?? models[0];

  // close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (models.length < 2 || !current) return <span />;
  return (
    <div className="model-menu" ref={rootRef}>
      <button type="button" className={`model-trigger ${open ? "open" : ""}`} onClick={() => setOpen(!open)}
        disabled={disabled} aria-haspopup="listbox" aria-expanded={open}>
        <Icon name="cpu" size={14} />
        <span>{current.label}</span>
        <Icon name="chevronDown" size={14} className="chevron" />
      </button>
      {open && (
        <div className={`model-popover ${placement}`} role="listbox" aria-label="Model">
          <div className="popover-label">Model</div>
          {models.map((m) => (
            <button type="button" key={m.id} role="option" aria-selected={m.id === current.id}
              className={`model-option ${m.id === current.id ? "selected" : ""}`}
              onClick={() => { onChange(m.id); setOpen(false); }}>
              <span className="model-option-text">
                <span className="model-option-name">{m.label}</span>
                {m.note && <span className="model-option-note">{m.note}</span>}
              </span>
              {m.id === current.id && <Icon name="check" size={15} className="model-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- composer ---------- */

function Composer({ onSend, loading, models, model, onModel, resetKey }) {
  const [text, setText] = useState("");
  const ref = useRef(null);

  // "New chat": clear what was typed and put the cursor back in the box
  useEffect(() => {
    if (!resetKey) return;
    setText("");
    ref.current?.focus();
  }, [resetKey]);

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
          <ModelMenu models={models} value={model} onChange={onModel} disabled={loading} />
          <button type="submit" className="send-btn" disabled={loading || !text.trim()} aria-label="Send">
            <Icon name="send" size={18} />
          </button>
        </div>
      </form>
      <div className="disclaimer">Answers come only from your documents and include citations. Check important details.</div>
    </div>
  );
}

/* ---------- quiz ---------- */

const LETTERS = ["A", "B", "C", "D"];
const POINTS = { correct: 1, partial: 0.5, incorrect: 0 };

function SourcePassage({ source }) {
  const [open, setOpen] = useState(false);
  if (!source) return null;
  return (
    <div className="passage">
      <button className="link-btn" onClick={() => setOpen(!open)}>
        <Icon name="book" size={13} /> {open ? "Hide" : "Show"} source passage
      </button>
      {open && (
        <div className="source-card">
          <div className="source-card-head"><span className="source-heading">{source.heading}</span></div>
          <p>{source.text}</p>
        </div>
      )}
    </div>
  );
}

function QuizQuestion({ quiz, index, result, onResult, onNext, model }) {
  const q = quiz.questions[index];
  const source = quiz.sources[q.source - 1];
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const isLast = index === quiz.questions.length - 1;

  useEffect(() => { setText(""); setError(""); }, [index]);

  async function checkShort() {
    if (!text.trim() || grading) return;
    setGrading(true);
    setError("");
    try {
      const g = await postJson("/api/quiz/grade", {
        question: q.question, answer: q.answer, userAnswer: text.trim(), source: source?.text ?? "", model: model || undefined,
      });
      onResult({ verdict: g.verdict, feedback: g.feedback, userAnswer: text.trim() });
    } catch (err) {
      setError(err.message);
    } finally {
      setGrading(false);
    }
  }

  const verdictLabel = { correct: "Correct", partial: "Partly right", incorrect: "Not quite" };

  return (
    <div className="quiz-card">
      <div className="quiz-progress">
        <div className="quiz-progress-text">
          <span>Question {index + 1} of {quiz.questions.length}</span>
          <span className={`type-badge ${q.type}`}>{q.type === "mcq" ? "Multiple choice" : "Short answer"}</span>
        </div>
        <div className="progress-track">
          <span style={{ width: `${((index + (result ? 1 : 0)) / quiz.questions.length) * 100}%` }} />
        </div>
      </div>

      <h2 className="quiz-question">{q.question}</h2>

      {q.type === "mcq" ? (
        <div className="options">
          {q.options.map((opt, i) => {
            const state = !result ? "" : i === q.answer ? "right" : i === result.chosen ? "wrong" : "dim";
            return (
              <button key={i} className={`option ${state}`} disabled={!!result}
                onClick={() => onResult({ chosen: i, verdict: i === q.answer ? "correct" : "incorrect" })}>
                <span className="option-letter">{LETTERS[i]}</span>
                <span className="option-text">{opt}</span>
                {state === "right" && <Icon name="check" size={16} />}
                {state === "wrong" && <Icon name="x" size={16} />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="short-answer">
          <textarea value={result ? result.userAnswer : text} onChange={(e) => setText(e.target.value)} disabled={!!result || grading}
            placeholder="Type your answer in a sentence or two…" rows={3}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) checkShort(); }} />
          {!result && (
            <div className="short-actions">
              <span className="hint">Ctrl + Enter to submit</span>
              <button className="primary-btn" onClick={checkShort} disabled={!text.trim() || grading}>
                {grading ? <><span className="spinner small" /> Checking…</> : "Check answer"}
              </button>
            </div>
          )}
          {error && <div className="error-box"><Icon name="alert" size={16} /> {error}</div>}
        </div>
      )}

      {result && (
        <div className={`feedback ${result.verdict}`}>
          <div className="feedback-head">
            <Icon name={result.verdict === "correct" ? "check" : result.verdict === "partial" ? "target" : "x"} size={16} />
            {verdictLabel[result.verdict]}
          </div>
          {result.feedback && <p>{result.feedback}</p>}
          {q.type === "short" && <p><strong>Model answer:</strong> {q.answer}</p>}
          {q.explanation && <p className="explanation">{q.explanation}</p>}
          <SourcePassage source={source} />
        </div>
      )}

      {result && (
        <div className="quiz-nav">
          <button className="primary-btn" onClick={onNext}>{isLast ? "See results" : "Next question"}</button>
        </div>
      )}
    </div>
  );
}

function QuizResults({ quiz, results, onRetry, onNewTopic, onNewDoc }) {
  const score = results.reduce((s, r) => s + POINTS[r.verdict], 0);
  const pct = Math.round((score / quiz.questions.length) * 100);
  const message = pct >= 80 ? "Excellent work!" : pct >= 50 ? "Good effort. Review the ones you missed." : "Worth another read. Try again!";
  return (
    <div className="quiz-card results">
      <div className="score-ring" style={{ "--pct": pct }}>
        <div className="score-inner">
          <span className="score-num">{score % 1 ? score.toFixed(1) : score}<small>/{quiz.questions.length}</small></span>
          <span className="score-pct">{pct}%</span>
        </div>
      </div>
      <h2>{message}</h2>
      <p className="muted">Topic: {quiz.topic}</p>

      <ol className="review">
        {quiz.questions.map((q, i) => (
          <li key={i} className={results[i].verdict}>
            <span className="review-mark">
              <Icon name={results[i].verdict === "correct" ? "check" : results[i].verdict === "partial" ? "target" : "x"} size={14} />
            </span>
            <span>{q.question}</span>
          </li>
        ))}
      </ol>

      <div className="results-actions">
        <button className="primary-btn" onClick={onRetry}><Icon name="refresh" size={15} /> New questions, same topic</button>
        <button className="ghost-btn" onClick={onNewTopic}>Choose another topic</button>
        <button className="ghost-btn" onClick={onNewDoc}>Another document</button>
      </div>
    </div>
  );
}

/* ---------- shared: pick a document, then a topic ---------- */

function DocPicker({ icon, iconClass, title, text, docs, loaded, onPick }) {
  return (
    <div className="welcome compact">
      <span className={`quiz-icon ${iconClass ?? ""}`}><Icon name={icon} size={26} /></span>
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="doc-grid">
        {docs.map((d) => (
          <button key={d} className="doc-card" onClick={() => onPick(d)}>
            <FileBadge name={d} />
            <span className="doc-card-name">{d}</span>
          </button>
        ))}
        {!loaded && [0, 1, 2, 3].map((i) => <div key={i} className="doc-card skeleton-box" aria-hidden="true" />)}
        {loaded && docs.length === 0 && <p className="muted">Upload a document first.</p>}
      </div>
    </div>
  );
}

// Topic suggestions per document, shared by Quiz and Interview so each document is read once
const topicsCache = new Map();

// Loads the AI's topic suggestions for a document (same endpoint for Quiz and Interview)
function useTopics(model) {
  const [doc, setDoc] = useState(null);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(name) {
    setDoc(name);
    setError("");
    if (topicsCache.has(name)) {
      setTopics(topicsCache.get(name));
      return;
    }
    setTopics([]);
    setLoading(true);
    try {
      const d = await postJson("/api/quiz/topics", { name, model: model || undefined });
      topicsCache.set(name, d.topics);
      setTopics(d.topics);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  return { doc, topics, loading, error, load };
}

function TopicStep({ doc, topics, loadingTopics, prompt, allTopicsOption, counts, count, onCount, onStart, starting, startLabel, startingLabel, error }) {
  const [topic, setTopic] = useState("");
  const [custom, setCustom] = useState("");
  useEffect(() => { setTopic(allTopicsOption ? ALL_TOPICS : ""); setCustom(""); }, [doc]);
  const chosen = custom.trim() || topic;
  const cards = allTopicsOption
    ? [{ title: ALL_TOPICS, description: "Questions from across the whole document." }, ...topics]
    : topics;

  return (
    <div className="topic-step">
      <div className="msg assistant">
        <Logo size={30} />
        <div className="msg-body">
          <p className="ai-line">
            {loadingTopics
              ? <>Reading <strong>{doc}</strong>…</>
              : <>I've read <strong>{doc}</strong>. <strong>{prompt}</strong></>}
          </p>
        </div>
      </div>

      {loadingTopics ? (
        <div className="topic-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="topic-card skeleton" />)}</div>
      ) : (
        <>
          <div className="topic-grid">
            {cards.map((t) => (
              <button key={t.title} className={`topic-card ${topic === t.title && !custom ? "selected" : ""} ${t.title === ALL_TOPICS ? "all" : ""}`}
                onClick={() => { setTopic(t.title); setCustom(""); }} disabled={starting}>
                <span className="topic-title">{t.title}</span>
                <span className="topic-desc">{t.description}</span>
              </button>
            ))}
          </div>

          <div className="topic-custom">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120}
              placeholder="…or type your own topic" disabled={starting}
              onKeyDown={(e) => { if (e.key === "Enter" && chosen) onStart(chosen); }} />
          </div>

          <div className="start-row">
            <div className="segmented" role="radiogroup" aria-label="Number of questions">
              {counts.map((n) => (
                <button key={n} role="radio" aria-checked={count === n} className={count === n ? "active" : ""}
                  onClick={() => onCount(n)} disabled={starting}>{n} questions</button>
              ))}
            </div>
            <button className="primary-btn" onClick={() => onStart(chosen)} disabled={!chosen || starting}>
              {starting ? <><span className="spinner small" /> {startingLabel}</> : startLabel}
            </button>
          </div>
        </>
      )}
      {error && <div className="error-box"><Icon name="alert" size={16} /> {error}</div>}
    </div>
  );
}

const ALL_TOPICS = "All topics";

function PracticeHeader({ phase, backLabel, onBack, busy, models, model, onModel }) {
  return (
    <div className="quiz-header">
      {phase !== "doc" ? (
        <button className="link-btn" onClick={onBack} disabled={busy}>
          <Icon name="arrowLeft" size={14} /> {backLabel}
        </button>
      ) : <span />}
      <ModelMenu models={models} value={model} onChange={onModel} disabled={busy} placement="down" />
    </div>
  );
}

/* ---------- quiz view ---------- */

function QuizView({ docs, loaded, models, model, onModel }) {
  const [phase, setPhase] = useState("doc"); // doc -> topic -> question -> done
  const topicsState = useTopics(model);
  const [count, setCount] = useState(5);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]);

  function pickDoc(name) {
    setPhase("topic");
    setError("");
    topicsState.load(name);
  }

  async function start(topic) {
    if (!topic) return;
    setError("");
    setStarting(true);
    try {
      const d = await postJson("/api/quiz/generate", { name: topicsState.doc, topic, count, model: model || undefined });
      setQuiz(d);
      setIndex(0);
      setResults([]);
      setPhase("question");
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  function record(result) {
    setResults((r) => { const next = [...r]; next[index] = result; return next; });
  }

  function next() {
    if (index < quiz.questions.length - 1) setIndex(index + 1);
    else setPhase("done");
  }

  return (
    <div className="thread quiz">
      <PracticeHeader phase={phase} busy={starting || topicsState.loading} models={models} model={model} onModel={onModel}
        backLabel={phase === "topic" ? "Documents" : "Topics"} onBack={() => setPhase(phase === "topic" ? "doc" : "topic")} />

      {phase === "doc" && (
        <DocPicker icon="quiz" title="Test your knowledge" docs={docs} loaded={loaded} onPick={pickDoc}
          text="Pick a document. I'll read it, suggest topics, and quiz you with multiple-choice and short-answer questions." />
      )}

      {phase === "topic" && (
        <TopicStep doc={topicsState.doc} topics={topicsState.topics} loadingTopics={topicsState.loading}
          prompt="Which topic would you like to be quizzed on?"
          counts={[5, 10]} count={count} onCount={setCount}
          onStart={start} starting={starting} startLabel="Start quiz" startingLabel="Writing questions…"
          error={topicsState.error || error} />
      )}

      {phase === "question" && quiz && (
        <QuizQuestion quiz={quiz} index={index} result={results[index]} onResult={record} onNext={next} model={model} />
      )}

      {phase === "done" && quiz && (
        <QuizResults quiz={quiz} results={results}
          onRetry={() => start(quiz.topic)}
          onNewTopic={() => setPhase("topic")}
          onNewDoc={() => setPhase("doc")} />
      )}
      {phase === "done" && starting && <div className="thinking center"><span className="dots"><i /><i /><i /></span> Writing new questions…</div>}
      {phase === "done" && error && <div className="error-box"><Icon name="alert" size={16} /> {error}</div>}
    </div>
  );
}

/* ---------- interview view ---------- */

function InterviewSession({ session, index, onIndex, onFinish }) {
  const total = session.questions.length;
  const q = session.questions[index];
  const isLast = index === total - 1;
  const cardRef = useRef(null);

  // ← / → keys move between questions: only while this view is on screen, never while typing
  useEffect(() => {
    function onKey(e) {
      if (!cardRef.current || cardRef.current.offsetParent === null) return; // Interview tab hidden
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight" && !isLast) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, isLast]);

  return (
    <div className="quiz-card interview-card" key={index} ref={cardRef}>
      <div className="quiz-progress">
        <div className="quiz-progress-text">
          <span>Question {index + 1} of {total}</span>
          <span className="interview-tags">
            {q.focus && <span className="type-badge focus">{q.focus}</span>}
            <span className={`type-badge level-${q.level.toLowerCase()}`}>{q.level}</span>
          </span>
        </div>
        <div className="progress-track"><span style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      </div>

      <div className="scenario-label"><Icon name="briefcase" size={14} /> Scenario</div>
      <p className="scenario">{q.question}</p>
      <p className="scenario-tip">Take a moment, then answer out loud as you would in the interview.</p>

      <div className="interview-nav">
        <button className="ghost-btn" onClick={() => onIndex(index - 1)} disabled={index === 0}>
          <Icon name="arrowLeft" size={15} /> Previous
        </button>
        <div className="dots-nav" aria-label="Jump to question">
          {session.questions.map((_, i) => (
            <button key={i} className={`dot ${i === index ? "active" : ""}`} onClick={() => onIndex(i)}
              aria-label={`Question ${i + 1}`} aria-current={i === index} />
          ))}
        </div>
        {isLast ? (
          <button className="primary-btn" onClick={onFinish}>Finish</button>
        ) : (
          <button className="primary-btn" onClick={() => onIndex(index + 1)}>
            Next <Icon name="arrowRight" size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function InterviewSummary({ session, onJump, onNewSet, onNewTopic, onNewDoc }) {
  return (
    <div className="quiz-card interview-summary">
      <div className="summary-head">
        <span className="quiz-icon interview small"><Icon name="check" size={20} /></span>
        <div>
          <h2>Practice complete</h2>
          <p className="muted">{session.questions.length} questions · {session.topic} · {session.name}</p>
        </div>
      </div>
      <ol className="question-list">
        {session.questions.map((q, i) => (
          <li key={i}>
            <button onClick={() => onJump(i)}>
              <span className="ql-n">{i + 1}</span>
              <span className="ql-text">{q.question}</span>
              <span className={`type-badge level-${q.level.toLowerCase()}`}>{q.level}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="results-actions">
        <button className="primary-btn" onClick={onNewSet}><Icon name="refresh" size={15} /> New set, same topic</button>
        <button className="ghost-btn" onClick={onNewTopic}>Choose another topic</button>
        <button className="ghost-btn" onClick={onNewDoc}>Another document</button>
      </div>
    </div>
  );
}

function InterviewView({ docs, loaded, models, model, onModel }) {
  const [phase, setPhase] = useState("doc"); // doc -> topic -> session -> summary
  const topicsState = useTopics(model);
  const [count, setCount] = useState(15);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState(0);

  function pickDoc(name) {
    setPhase("topic");
    setError("");
    topicsState.load(name);
  }

  async function start(topic) {
    if (!topic) return;
    setError("");
    setStarting(true);
    try {
      const d = await postJson("/api/interview/generate", { name: topicsState.doc, topic, count, model: model || undefined });
      setSession(d);
      setIndex(0);
      setPhase("session");
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  const back = { topic: ["Documents", "doc"], session: ["Topics", "topic"], summary: ["Topics", "topic"] }[phase] ?? ["", "doc"];

  return (
    <div className="thread quiz">
      <PracticeHeader phase={phase} busy={starting || topicsState.loading} models={models} model={model} onModel={onModel}
        backLabel={back[0]} onBack={() => setPhase(back[1])} />

      {phase === "doc" && (
        <DocPicker icon="briefcase" iconClass="interview" title="Interview practice" docs={docs} loaded={loaded} onPick={pickDoc}
          text="Pick a document. I'll turn it into 15–20 real-world, scenario-based interview questions. Answer each one out loud, then move on." />
      )}

      {phase === "topic" && (
        <TopicStep doc={topicsState.doc} topics={topicsState.topics} loadingTopics={topicsState.loading}
          prompt="Which topic should the interview focus on?" allTopicsOption
          counts={[15, 20]} count={count} onCount={setCount}
          onStart={start} starting={starting} startLabel="Start interview" startingLabel="Preparing scenarios…"
          error={topicsState.error || error} />
      )}

      {phase === "session" && session && (
        <InterviewSession session={session} index={index} onIndex={setIndex} onFinish={() => setPhase("summary")} />
      )}

      {phase === "summary" && session && (
        <InterviewSummary session={session}
          onJump={(i) => { setIndex(i); setPhase("session"); }}
          onNewSet={() => start(session.topic)}
          onNewTopic={() => setPhase("topic")}
          onNewDoc={() => setPhase("doc")} />
      )}
      {phase === "summary" && starting && <div className="thinking center"><span className="dots"><i /><i /><i /></span> Preparing a new set…</div>}
      {phase === "summary" && error && <div className="error-box"><Icon name="alert" size={16} /> {error}</div>}
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
  const [mode, setMode] = useState("chat"); // "chat" | "quiz" | "interview"
  const [chatKey, setChatKey] = useState(0); // bumps on "New chat"
  const chatIdRef = useRef(0); // which conversation a reply belongs to
  const abortRef = useRef(null); // cancels the question in flight
  const bottomRef = useRef(null);
  const [chats, setChats] = useState(loadChats); // saved conversations, newest first
  const [currentId, setCurrentId] = useState(null); // the saved chat on screen (null = not saved yet)
  const currentIdRef = useRef(null);

  // Save the conversation whenever it gains a message (opening an old chat doesn't re-save it)
  useEffect(() => {
    const id = currentIdRef.current;
    if (!id || messages.length === 0) return;
    setChats((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing && existing.messages.length === messages.length) return prev;
      const title = (messages.find((m) => m.role === "user")?.content ?? "New chat").slice(0, 80);
      return [{ id, title, updatedAt: Date.now(), messages }, ...prev.filter((c) => c.id !== id)].slice(0, MAX_CHATS);
    });
  }, [messages]);

  useEffect(() => { saveChats(chats); }, [chats]);

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
    const chatId = chatIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    if (!currentIdRef.current) {
      // first question of a new conversation: give it an id so it gets saved to history
      currentIdRef.current = newChatId();
      setCurrentId(currentIdRef.current);
    }
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);
    try {
      const data = await postJson("/api/chat", { question, model: model || undefined }, controller.signal);
      if (chatId !== chatIdRef.current) return; // the user started a new chat meanwhile: drop the old reply
      setMessages((m) => [...m, {
        role: "assistant", content: data.answer, sources: data.sources,
        model: data.model, seconds: data.seconds, tokens: data.tokens,
      }]);
    } catch (err) {
      if (chatId !== chatIdRef.current || err.name === "AbortError") return;
      setMessages((m) => [...m, { role: "assistant", content: err.message, error: true }]);
    } finally {
      if (chatId === chatIdRef.current) setLoading(false);
    }
  }

  // Show a conversation: [] for a new chat, or a saved chat's messages
  function showChat(id, msgs) {
    chatIdRef.current += 1; // any reply still on its way belongs to the chat we're leaving
    abortRef.current?.abort();
    setLoading(false);
    currentIdRef.current = id;
    setCurrentId(id);
    setMessages(msgs);
    setMode("chat");
    setSidebarOpen(false);
    setChatKey((k) => k + 1);
  }

  const newChat = () => showChat(null, []);

  function openChat(id) {
    const chat = chats.find((c) => c.id === id);
    if (chat) showChat(id, chat.messages);
  }

  function deleteChat(id) {
    const chat = chats.find((c) => c.id === id);
    if (!chat || !confirm(`Delete the chat "${chat.title}"?`)) return;
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id === currentIdRef.current) newChat();
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
      <Sidebar documents={documents} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNewChat={newChat}
        history={{ chats, currentId, onOpen: openChat, onDelete: deleteChat }} />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="mode-switch" role="tablist" aria-label="Mode">
            <button role="tab" aria-selected={mode === "chat"} className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}>
              <Icon name="chat" size={15} /> <span className="tab-label">Chat</span>
            </button>
            <button role="tab" aria-selected={mode === "quiz"} className={mode === "quiz" ? "active" : ""} onClick={() => setMode("quiz")}>
              <Icon name="quiz" size={15} /> <span className="tab-label">Quiz</span>
            </button>
            <button role="tab" aria-selected={mode === "interview"} className={mode === "interview" ? "active" : ""} onClick={() => setMode("interview")}>
              <Icon name="briefcase" size={15} /> <span className="tab-label">Interview</span>
            </button>
          </div>
          <div className="topbar-actions">
            {mode === "chat" && messages.length > 0 && (
              <button className="ghost-btn" onClick={newChat}><Icon name="plus" size={15} /> New chat</button>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Quiz stays mounted while hidden, so switching to Chat and back keeps your progress */}
        <div className="scroll" hidden={mode !== "quiz"}>
          <QuizView docs={documents.docs} loaded={documents.loaded} models={models} model={model} onModel={chooseModel} />
        </div>

        <div className="scroll" hidden={mode !== "interview"}>
          <InterviewView docs={documents.docs} loaded={documents.loaded} models={models} model={model} onModel={chooseModel} />
        </div>

        <div className="scroll" hidden={mode !== "chat"}>
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

        {mode === "chat" && <Composer onSend={send} loading={loading} models={models} model={model} onModel={chooseModel} resetKey={chatKey} />}
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
