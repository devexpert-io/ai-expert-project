"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { CHAT_CONTENT_LIMIT, CHAT_HISTORY_LIMIT, CHAT_MESSAGE_LIMIT, CHAT_UNAVAILABLE, type ChatMessage } from "../../lib/chat";
import { formatPrice } from "../../lib/format-price";
import type { ChatRecommendation } from "../../lib/chat";
import styles from "./chat.module.css";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendationsByMessage, setRecommendationsByMessage] = useState<Record<number, readonly ChatRecommendation[]>>({});
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
      const hasRecommendations = result && typeof result === "object" && "recommendations" in result;
      const nextRecommendations = Array.isArray(result?.recommendations) ? parseRecommendations(result.recommendations) : [];
      if (response.ok && result.ok === true && typeof result.reply === "string" && result.reply.trim() && result.reply.length <= CHAT_CONTENT_LIMIT && (!hasRecommendations || Array.isArray(result.recommendations) && nextRecommendations !== null)) {
        const assistantIndex = messages.length + 1;
        setMessages((previous) => [...previous, { role: "user", content: message }, { role: "assistant", content: result.reply }]);
        setRecommendationsByMessage((previous) => ({ ...previous, [assistantIndex]: nextRecommendations ?? [] }));
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
        {messages.map((message, index) => { const recommendations = recommendationsByMessage[index] ?? []; return <div key={index} className={message.role === "user" ? styles.user : styles.assistant}><strong>{message.role === "user" ? "Tú" : "Asistente IA"}</strong><p>{message.content}</p>{message.role === "assistant" && recommendations.length > 0 && <section aria-label="Recomendaciones" className={styles.recommendations}><h3>Te puede interesar</h3><ul>{recommendations.map((recommendation) => <li key={`${recommendation.productId}-${recommendation.variant?.id ?? "base"}`}><Link className={styles.recommendation} href={recommendation.variant ? `/products/${recommendation.slug}?size=${encodeURIComponent(recommendation.variant.size)}&color=${encodeURIComponent(recommendation.variant.color)}` : `/products/${recommendation.slug}`}><Image alt={`Imagen de ${recommendation.name}`} height={96} width={77} src={recommendation.imageUrl} /><span><strong>{recommendation.name}</strong><small>{recommendation.categoryName}</small><b>{formatPrice(recommendation.priceCents)}</b>{recommendation.variant ? <small>{recommendation.variant.size} · {recommendation.variant.color} · {recommendation.variant.stock} disponibles</small> : <small>Disponible</small>}</span></Link></li>)}</ul></section>}</div>; })}
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

function parseRecommendations(value: unknown[]): readonly ChatRecommendation[] | null {
  if (value.length > 3) return null;
  const parsed: ChatRecommendation[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.productId !== "string" || typeof candidate.slug !== "string" || typeof candidate.name !== "string" || typeof candidate.imageUrl !== "string" || typeof candidate.categoryName !== "string" || typeof candidate.priceCents !== "number") return null;
    const variant = candidate.variant;
    if (variant !== null && (typeof variant !== "object" || variant === null || Array.isArray(variant))) return null;
    if (variant !== null) {
      const current = variant as Record<string, unknown>;
      if (typeof current.id !== "string" || typeof current.size !== "string" || typeof current.color !== "string" || typeof current.priceCents !== "number" || typeof current.stock !== "number") return null;
    }
    parsed.push(candidate as unknown as ChatRecommendation);
  }
  return parsed;
}
