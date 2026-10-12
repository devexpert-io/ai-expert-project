"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import {
  PAYMENT_ERROR_UNAVAILABLE,
  PAYMENT_REJECTED_NOTICE,
  type PaymentOutcome,
  type PaymentResponse,
} from "../../lib/payment";
import { formatPrice } from "../../lib/format-price";

import styles from "./simulated-payment.module.css";

type PaymentState = "idle" | "loading" | "success" | "rejected" | "error";

function createAttemptKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SimulatedPayment() {
  const [outcome, setOutcome] = useState<PaymentOutcome>("approved");
  const [state, setState] = useState<PaymentState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<Extract<PaymentResponse, { ok: true }> | null>(null);
  const attemptKey = useRef<string | null>(null);

  function chooseOutcome(nextOutcome: PaymentOutcome) {
    setOutcome(nextOutcome);
    setState("idle");
    setMessage(null);
    setOrder(null);
  }

  async function submitPayment({ newAttempt }: Readonly<{ newAttempt: boolean }>) {
    if (newAttempt || !attemptKey.current) {
      attemptKey.current = createAttemptKey();
    }

    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/checkout/payment", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attemptKey.current,
        },
        body: JSON.stringify({ outcome }),
      });

      let body: PaymentResponse | null = null;
      try {
        body = (await response.json()) as PaymentResponse;
      } catch {
        body = null;
      }

      if (!response.ok || !body || body.ok !== true) {
        setState("error");
        setMessage(body && !body.ok ? body.message : PAYMENT_ERROR_UNAVAILABLE);
        return;
      }

      setOrder(body);
      if (body.outcome === "rejected") {
        // A retry after a persisted cancellation is a new operation by contract.
        attemptKey.current = null;
        setState("rejected");
      } else {
        setState("success");
      }
    } catch {
      // Keep the key so a network retry replays the same operation safely.
      setState("error");
      setMessage("No se ha podido conectar. Inténtalo de nuevo.");
    }
  }

  return (
    <section aria-labelledby="simulated-payment-title" className={styles.payment}>
      <div className={styles.heading}>
        <p className={styles.eyebrow}>Último paso</p>
        <h3 id="simulated-payment-title">Pago simulado</h3>
      </div>
      <p className={styles.notice}>{PAYMENT_REJECTED_NOTICE}</p>

      {state === "success" && order ? (
        <div aria-live="polite" className={styles.success} role="status">
          <strong>Pago aprobado</strong>
          <span>Pedido {order.orderId}</span>
          <span>Total: {formatPrice(order.totalCents)}</span>
          <Link className={styles.primaryAction} href="/">
            Seguir comprando
          </Link>
        </div>
      ) : state === "rejected" && order ? (
        <div aria-live="polite" className={styles.rejected} role="alert">
          <strong>Pago rechazado · pedido cancelado</strong>
          <span>Pedido {order.orderId}</span>
          <span>Total conservado: {formatPrice(order.totalCents)}</span>
          <button
            className={styles.secondaryAction}
            onClick={() => {
              attemptKey.current = null;
              setMessage(null);
              setOrder(null);
              setState("idle");
            }}
            type="button"
          >
            Reintentar pago
          </button>
        </div>
      ) : (
        <>
          <fieldset className={styles.outcomes}>
            <legend>Resultado de la simulación</legend>
            <label>
              <input
                checked={outcome === "approved"}
                disabled={state === "loading"}
                name="simulated-payment-outcome"
                onChange={() => chooseOutcome("approved")}
                type="radio"
              />
              Aprobar pago
            </label>
            <label>
              <input
                checked={outcome === "rejected"}
                disabled={state === "loading"}
                name="simulated-payment-outcome"
                onChange={() => chooseOutcome("rejected")}
                type="radio"
              />
              Rechazar pago
            </label>
          </fieldset>
          <button
            className={styles.primaryAction}
            disabled={state === "loading"}
            onClick={() => void submitPayment({ newAttempt: false })}
            type="button"
          >
            {state === "loading"
              ? "Procesando…"
              : state === "error"
                ? "Reintentar conexión"
                : "Pagar de forma simulada"}
          </button>
          {message ? (
            <p aria-live="assertive" className={styles.error} role="alert">
              {message}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

