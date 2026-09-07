"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CHAT_CONTENT_LIMIT, CHAT_HISTORY_LIMIT, CHAT_MESSAGE_LIMIT, CHAT_UNAVAILABLE, type ChatMessage } from "../../lib/chat";
import styles from "./chat.module.css";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => { if (open) field.current?.focus(); }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, pending, open, error]);
  function close() { setOpen(false); trigger.current?.focus(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(message);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: messages.slice(-CHAT_HISTORY_LIMIT) }), signal: controller.signal,
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok && result.ok === true && typeof result.reply === "string" && result.reply.trim() && result.reply.length <= CHAT_CONTENT_LIMIT) {
        setMessages((previous) => [...previous, { role: "user", content: message }, { role: "assistant", content: result.reply }]);
        setDraft("");
      } else {
        setError(result.ok === false && typeof result.message === "string" ? result.message : CHAT_UNAVAILABLE);
      }
    } catch { if (!controller.signal.aborted) setError(CHAT_UNAVAILABLE); }
    finally {
      if (!controller.signal.aborted) { setPending(null); active.current = null; }
    }
  }
  return <div className={styles.widget}>
    <button ref={trigger} className={styles.trigger} aria-expanded={open} aria-controls="chat-panel" onClick={() => open ? close() : setOpen(true)}>{open ? "Cerrar chat" : "Abrir chat"}</button>
    {open && <section id="chat-panel" aria-labelledby="chat-title" className={styles.panel} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }}>
      <header className={styles.header}><div><span className={styles.eyebrow}>ESTUDIO · ASISTENTE IA</span><h2 id="chat-title">Hablemos de tu próxima prenda</h2></div><button aria-label="Cerrar panel del chat" onClick={close}>×</button></header>
      <p className={styles.notice}>Tus mensajes se envían a DevExpert Inference. Evita compartir datos personales.</p>
      <div ref={log} role="log" aria-label="Conversación" className={styles.log} tabIndex={0}>
        {messages.length === 0 && <p className={styles.empty}>¿Dudas sobre tallas, colores o disponibilidad? Consulta nuestro catálogo aquí.</p>}
        {messages.map((message, index) => <div key={index} className={message.role === "user" ? styles.user : styles.assistant}><strong>{message.role === "user" ? "Tú" : "Asistente IA"}</strong><p>{message.content}</p></div>)}
        {pending && <div className={styles.user}><strong>Tú</strong><p>{pending}</p></div>}
      </div>
      <div className={styles.feedback}>{pending && <p role="status">Consultando el catálogo…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}</div>
      <form onSubmit={submit} className={styles.form}>
        <label htmlFor="chat-message">Tu consulta</label>
        <textarea ref={field} id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={CHAT_MESSAGE_LIMIT} rows={2} readOnly={pending !== null} placeholder="¿Qué tallas tiene la camiseta básica?" />
        <button type="submit" disabled={pending !== null || !draft.trim()}>{pending ? "Enviando…" : "Enviar"}</button>
      </form>
    </section>}
  </div>;
}
