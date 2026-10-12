import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CHECKOUT_DRAFT_STORAGE_KEY } from "../../lib/checkout";
import { CheckoutForm } from "./CheckoutForm";

const validValues = {
  name: "Ana García",
  email: "ana@example.com",
  phone: "+34 600 123 456",
  shippingAddress: "Calle Mayor 1, 2º B, Madrid",
};

describe("CheckoutForm", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows field errors without network calls and preserves entered values", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<CheckoutForm />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Revisa los campos");
    expect(screen.getByLabelText("Nombre")).toHaveAttribute(
      "aria-describedby",
      "checkout-name-error",
    );
    expect(screen.getByText("Escribe tu nombre.")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the user's values when validation fails", () => {
    render(<CheckoutForm />);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "  Ana  " },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));

    expect(screen.getByLabelText("Nombre")).toHaveValue("  Ana  ");
    expect(screen.getByLabelText("Email")).toHaveValue("not-an-email");
    expect(window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("stores exactly the four-field versioned draft and announces success", async () => {
    render(<CheckoutForm />);

    for (const [field, value] of Object.entries(validValues)) {
      fireEvent.change(screen.getByLabelText(
        field === "shippingAddress"
          ? "Dirección de envío"
          : field === "name"
            ? "Nombre"
            : field === "email"
              ? "Email"
              : "Teléfono",
      ), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Datos guardados en esta pestaña.",
      ),
    );
    expect(JSON.parse(window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY) ?? "null")).toEqual(
      validValues,
    );
  });

  it("rehydrates only a valid draft and rejects extra fields", async () => {
    window.sessionStorage.setItem(
      CHECKOUT_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...validValues, extra: "no" }),
    );
    render(<CheckoutForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Nombre")).toHaveValue(""),
    );
    expect(window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    cleanup();
    window.sessionStorage.setItem(
      CHECKOUT_DRAFT_STORAGE_KEY,
      JSON.stringify(validValues),
    );
    render(<CheckoutForm />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre")).toHaveValue("Ana García"),
    );
  });

  it("registers without persisting the password and announces the active session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<CheckoutForm />);

    for (const [field, value] of Object.entries(validValues)) {
      fireEvent.change(screen.getByLabelText(
        field === "shippingAddress"
          ? "Dirección de envío"
          : field === "name"
            ? "Nombre"
            : field === "email"
              ? "Email"
              : "Teléfono",
      ), { target: { value } });
    }
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "correct horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() =>
      expect(screen.getByText("Cuenta creada. Sesión iniciada.")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/checkout",
      expect.objectContaining({ method: "POST" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      mode: "register",
      ...validValues,
      password: "correct horse",
    });
    expect(JSON.parse(window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY) ?? "null")).toEqual(
      validValues,
    );
    expect(window.sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)).not.toContain(
      "correct horse",
    );
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(screen.getByText("Sesión activa")).toBeInTheDocument();
  });

  it("revokes the session from the authenticated checkout state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<CheckoutForm authenticated />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Sesión cerrada."),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });
});
