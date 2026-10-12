"use client";

import { type FormEvent, useEffect, useState } from "react";

import {
  AUTH_ERROR_INVALID,
  validatePassword,
  type AuthMode,
} from "../../lib/auth";
import {
  CHECKOUT_DRAFT_STORAGE_KEY,
  normalizeCheckoutDraft,
  parseCheckoutDraft,
  serializeCheckoutDraft,
  type CheckoutDraft,
  type CheckoutDraftErrors,
  type CheckoutDraftField,
  validateCheckoutDraft,
} from "../../lib/checkout";
import { SimulatedPayment } from "./SimulatedPayment";

import styles from "./checkout-form.module.css";

const EMPTY_DRAFT: CheckoutDraft = {
  name: "",
  email: "",
  phone: "",
  shippingAddress: "",
};

type FieldDefinition = Readonly<{
  field: CheckoutDraftField;
  label: string;
  autoComplete: string;
  type: "text" | "email" | "tel" | "textarea";
  hint?: string;
}>;

const FIELD_DEFINITIONS: readonly FieldDefinition[] = [
  { field: "name", label: "Nombre", autoComplete: "name", type: "text" },
  {
    field: "email",
    label: "Email",
    autoComplete: "email",
    type: "email",
  },
  {
    field: "phone",
    label: "Teléfono",
    autoComplete: "tel",
    type: "tel",
  },
  {
    field: "shippingAddress",
    label: "Dirección de envío",
    autoComplete: "shipping street-address",
    type: "textarea",
    hint: "Incluye calle, número, piso y ciudad.",
  },
];

function removeError(
  errors: CheckoutDraftErrors,
  field: CheckoutDraftField,
): CheckoutDraftErrors {
  if (!errors[field]) {
    return errors;
  }

  const next = { ...errors };
  delete next[field];
  return next;
}

function saveDraft(values: CheckoutDraft): string | null {
  const normalized = normalizeCheckoutDraft(values);
  const serialized = serializeCheckoutDraft(normalized);
  if (!serialized) {
    return null;
  }

  try {
    window.sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, serialized);
    return serialized;
  } catch {
    return null;
  }
}

type CheckoutFormProps = Readonly<{
  authenticated?: boolean;
}>;

export function CheckoutForm({ authenticated = false }: CheckoutFormProps) {
  const [values, setValues] = useState<CheckoutDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<CheckoutDraftErrors>({});
  const [mode, setMode] = useState<AuthMode>("register");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [status, setStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(authenticated);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
      if (stored === null) {
        return;
      }

      const draft = parseCheckoutDraft(stored);
      if (draft) {
        setValues(draft);
        setStatus("Hemos recuperado tus datos guardados en esta pestaña.");
      } else {
        window.sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      }
    } catch {
      // Private browsing/storage restrictions must not break the checkout UI.
    }
  }, []);

  function updateValue(field: CheckoutDraftField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => removeError(current, field));
    setStatus(null);
  }

  function handleSaveDraft() {
    const nextErrors = validateCheckoutDraft(values);
    setErrors(nextErrors);
    setPasswordError(undefined);
    if (Object.keys(nextErrors).length > 0) {
      setStatus(null);
      return;
    }

    const normalized = normalizeCheckoutDraft(values);
    setValues(normalized);
    if (!saveDraft(normalized)) {
      setStatus(null);
      setErrors({
        name: "No se han podido validar tus datos. Revisa el formulario.",
      });
      return;
    }

    setStatus("Datos guardados en esta pestaña.");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCheckoutDraft(values);
    const nextPasswordError = validatePassword(password);
    setErrors(nextErrors);
    setPasswordError(nextPasswordError);

    if (Object.keys(nextErrors).length > 0 || nextPasswordError) {
      setStatus(null);
      return;
    }

    const normalized = normalizeCheckoutDraft(values);
    setValues(normalized);
    if (!saveDraft(normalized)) {
      setStatus(null);
      setErrors({
        name: "No se han podido validar tus datos. Revisa el formulario.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          email: normalized.email,
          password,
          name: normalized.name,
          phone: normalized.phone,
          shippingAddress: normalized.shippingAddress,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || body.ok !== true) {
        setStatus(body.message ?? AUTH_ERROR_INVALID);
        return;
      }

      setPassword("");
      setPasswordError(undefined);
      setIsAuthenticated(true);
      setStatus(mode === "register" ? "Cuenta creada. Sesión iniciada." : "Sesión iniciada.");
    } catch {
      setStatus("No se ha podido conectar. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setStatus("No se ha podido cerrar la sesión. Inténtalo de nuevo.");
        return;
      }
      setIsAuthenticated(false);
      setMode("login");
      setStatus("Sesión cerrada.");
    } catch {
      setStatus("No se ha podido cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0 || Boolean(passwordError);

  return (
    <form className={styles.form} noValidate onSubmit={handleAuthSubmit}>
      <p className={styles.note}>
        Guarda estos datos para retomarlos durante el checkout.
      </p>
      {hasErrors ? (
        <p aria-live="assertive" className={styles.alert} role="alert">
          Revisa los campos marcados antes de continuar.
        </p>
      ) : null}

      {isAuthenticated ? (
        <div className={styles.authenticated} role="status">
          <strong>Sesión activa</strong>
          <span>Tu carrito queda asociado a esta cuenta.</span>
          <button
            className={styles.secondaryAction}
            disabled={isSubmitting}
            onClick={handleLogout}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}

      {isAuthenticated ? <SimulatedPayment /> : null}

      <div className={styles.fields}>
        {FIELD_DEFINITIONS.map((definition) => {
          const error = errors[definition.field];
          const errorId = `checkout-${definition.field}-error`;
          const inputId = `checkout-${definition.field}`;
          const describedBy = error ? errorId : undefined;
          const value = values[definition.field];
          const commonProps = {
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
            autoComplete: definition.autoComplete,
            className: styles.input,
            id: inputId,
            name: definition.field,
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              updateValue(definition.field, event.target.value),
            required: true,
            value,
          };

          return (
            <div className={styles.field} key={definition.field}>
              <label htmlFor={inputId}>{definition.label}</label>
              {definition.type === "textarea" ? (
                <textarea {...commonProps} rows={4} />
              ) : (
                <input {...commonProps} type={definition.type} />
              )}
              {definition.hint && !error ? (
                <p className={styles.hint}>{definition.hint}</p>
              ) : null}
              {error ? (
                <p className={styles.error} id={errorId}>
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {!isAuthenticated ? (
        <>
          <fieldset className={styles.modeGroup}>
            <legend>Acceso</legend>
            <div className={styles.modeChoices}>
              <label>
                <input
                  checked={mode === "register"}
                  name="auth-mode"
                  onChange={() => {
                    setMode("register");
                    setStatus(null);
                  }}
                  type="radio"
                />
                Crear cuenta
              </label>
              <label>
                <input
                  checked={mode === "login"}
                  name="auth-mode"
                  onChange={() => {
                    setMode("login");
                    setStatus(null);
                  }}
                  type="radio"
                />
                Ya tengo cuenta
              </label>
            </div>
          </fieldset>

          <div className={styles.field}>
            <label htmlFor="checkout-password">Contraseña</label>
            <input
              aria-describedby={passwordError ? "checkout-password-error" : undefined}
              aria-invalid={passwordError ? true : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className={styles.input}
              id="checkout-password"
              name="password"
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordError(undefined);
                setStatus(null);
              }}
              required
              type="password"
              value={password}
            />
            {passwordError ? (
              <p className={styles.error} id="checkout-password-error">
                {passwordError}
              </p>
            ) : (
              <p className={styles.hint}>Al menos 8 caracteres.</p>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.secondaryAction} onClick={handleSaveDraft} type="button">
              Guardar datos
            </button>
            <button className={styles.submit} disabled={isSubmitting} type="submit">
              {isSubmitting ? "Procesando…" : mode === "register" ? "Crear cuenta" : "Entrar"}
            </button>
          </div>
        </>
      ) : null}

      {status ? (
        <p aria-live="polite" className={styles.status} role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
