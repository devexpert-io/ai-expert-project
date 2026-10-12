"use client";

import { type FormEvent, useEffect, useState } from "react";

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

export function CheckoutForm() {
  const [values, setValues] = useState<CheckoutDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<CheckoutDraftErrors>({});
  const [status, setStatus] = useState<string | null>(null);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCheckoutDraft(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus(null);
      return;
    }

    const normalized = normalizeCheckoutDraft(values);
    setValues(normalized);
    const serialized = serializeCheckoutDraft(normalized);
    if (!serialized) {
      setStatus(null);
      setErrors({
        name: "No se han podido validar tus datos. Revisa el formulario.",
      });
      return;
    }

    try {
      window.sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, serialized);
      setStatus("Datos guardados en esta pestaña.");
    } catch {
      setStatus("No se han podido guardar los datos en esta pestaña.");
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <p className={styles.note}>
        Guarda estos datos para retomarlos al crear tu cuenta. Todavía no hay
        ningún cobro ni pedido.
      </p>
      {hasErrors ? (
        <p aria-live="assertive" className={styles.alert} role="alert">
          Revisa los campos marcados antes de guardar tus datos.
        </p>
      ) : null}

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

      <button className={styles.submit} type="submit">
        Guardar datos
      </button>
      {status ? (
        <p aria-live="polite" className={styles.status} role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}
