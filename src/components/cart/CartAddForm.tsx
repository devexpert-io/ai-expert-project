"use client";

import { type FormEvent, useState } from "react";

import {
  CART_ERROR_INVALID,
  CART_QUANTITY_MAX,
  type CartAddResponse,
  type CartAddSuccess,
} from "../../lib/cart";

import styles from "./cart-add.module.css";

type CartAddFormProps = Readonly<{
  variantId: string;
}>;

const CART_ERROR_NETWORK =
  "No se ha podido actualizar el carrito. Inténtalo de nuevo.";

function isCartAddSuccess(value: unknown): value is CartAddSuccess {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const response = value as Partial<CartAddSuccess>;
  const item = response.item;
  const itemCount = response.itemCount;
  return (
    response.ok === true &&
    typeof item === "object" &&
    item !== null &&
    typeof item.variantId === "string" &&
    typeof item.quantity === "number" &&
    Number.isSafeInteger(item.quantity) &&
    item.quantity >= 1 &&
    typeof itemCount === "number" &&
    Number.isSafeInteger(itemCount) &&
    itemCount >= 1
  );
}

function getErrorMessage(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return CART_ERROR_NETWORK;
  }

  const response = value as Partial<Extract<CartAddResponse, { ok: false }>>;
  return typeof response.message === "string" && response.message.trim()
    ? response.message
    : CART_ERROR_NETWORK;
}

export function CartAddForm({ variantId }: CartAddFormProps) {
  const [quantity, setQuantity] = useState("1");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<CartAddSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedQuantity = Number(quantity);
    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > CART_QUANTITY_MAX
    ) {
      setSuccess(null);
      setError(CART_ERROR_INVALID);
      return;
    }

    setPending(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ variantId, quantity: parsedQuantity }),
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !isCartAddSuccess(payload)) {
        setError(getErrorMessage(payload));
        return;
      }

      setSuccess(payload);
    } catch {
      setError(CART_ERROR_NETWORK);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label="Añadir al carrito"
      className={styles.form}
    noValidate
      onSubmit={handleSubmit}
    >
      <div className={styles.quantityGroup}>
        <label htmlFor="cart-quantity">Cantidad</label>
        <input
          aria-describedby={error ? "cart-add-error" : undefined}
          className={styles.quantityInput}
          disabled={pending}
          id="cart-quantity"
          inputMode="numeric"
          min={1}
          max={CART_QUANTITY_MAX}
          name="quantity"
          onChange={(event) => setQuantity(event.target.value)}
          step={1}
          type="number"
          value={quantity}
        />
      </div>
      <button
        aria-busy={pending}
        className={styles.submitButton}
        disabled={pending}
        type="submit"
      >
        {pending ? "Añadiendo…" : "Añadir al carrito"}
      </button>
      {success ? (
        <p aria-live="polite" className={styles.success} role="status">
          Añadido al carrito · {success.item.quantity} {success.item.quantity === 1 ? "unidad" : "unidades"} de esta variante · {success.itemCount} en total
        </p>
      ) : null}
      {error ? (
        <p aria-live="assertive" className={styles.error} id="cart-add-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
