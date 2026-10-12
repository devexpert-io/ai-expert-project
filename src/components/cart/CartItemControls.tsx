"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CART_ERROR_INVALID,
  CART_QUANTITY_MAX,
  type CartMutationSuccess,
} from "../../lib/cart";

import styles from "./cart-item-controls.module.css";

type CartItemControlsProps = Readonly<{
  variantId: string;
  productName: string;
  quantity: number;
}>;

const CART_ERROR_NETWORK =
  "No se ha podido actualizar el carrito. Inténtalo de nuevo.";

function isCartMutationSuccess(value: unknown): value is CartMutationSuccess {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const response = value as Partial<CartMutationSuccess>;
  const cart = response.cart;
  return (
    response.ok === true &&
    typeof cart === "object" &&
    cart !== null &&
    !Array.isArray(cart) &&
    Array.isArray(cart.items) &&
    Number.isSafeInteger(cart.itemCount) &&
    cart.itemCount >= 0 &&
    Number.isSafeInteger(cart.subtotalCents) &&
    cart.subtotalCents >= 0
  );
}

async function readMessage(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      !Array.isArray(payload) &&
      typeof (payload as { message?: unknown }).message === "string" &&
      (payload as { message: string }).message.trim()
    ) {
      return (payload as { message: string }).message;
    }
  } catch {
    // The network fallback below is intentionally constant and safe.
  }

  return CART_ERROR_NETWORK;
}

type MutationMethod = "PATCH" | "DELETE";

export function CartItemControls({
  variantId,
  productName,
  quantity,
}: CartItemControlsProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(quantity));
  const [pending, setPending] = useState<MutationMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = `cart-quantity-${variantId}`;
  const errorId = `cart-error-${variantId}`;

  async function mutate(method: MutationMethod, body: unknown) {
    setPending(method);
    setError(null);

    try {
      const response = await fetch("/api/cart/items", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setError(await readMessage(response));
        return;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!isCartMutationSuccess(payload)) {
        setError(CART_ERROR_NETWORK);
        return;
      }

      router.refresh();
    } catch {
      setError(CART_ERROR_NETWORK);
    } finally {
      setPending(null);
    }
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(value);
    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > CART_QUANTITY_MAX
    ) {
      setError(CART_ERROR_INVALID);
      return;
    }

    void mutate("PATCH", { variantId, quantity: parsedQuantity });
  }

  function handleRemove() {
    void mutate("DELETE", { variantId });
  }

  const disabled = pending !== null;
  return (
    <div className={styles.wrapper}>
      <form
        aria-label={`Actualizar cantidad de ${productName}`}
        className={styles.form}
        noValidate
        onSubmit={handleUpdate}
      >
        <label htmlFor={inputId}>Cantidad</label>
        <div className={styles.actions}>
          <input
            aria-describedby={error ? errorId : undefined}
            className={styles.input}
            disabled={disabled}
            id={inputId}
            inputMode="numeric"
            max={CART_QUANTITY_MAX}
            min={1}
            onChange={(event) => setValue(event.target.value)}
            step={1}
            type="number"
            value={value}
          />
          <button
            aria-busy={pending === "PATCH"}
            className={styles.updateButton}
            disabled={disabled}
            type="submit"
          >
            {pending === "PATCH" ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </form>
      <button
        aria-busy={pending === "DELETE"}
        className={styles.removeButton}
        disabled={disabled}
        onClick={handleRemove}
        type="button"
      >
        {pending === "DELETE" ? "Eliminando…" : "Eliminar"}
      </button>
      {error ? (
        <p aria-live="assertive" className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
