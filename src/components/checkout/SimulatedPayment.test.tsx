import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SimulatedPayment } from "./SimulatedPayment";

describe("SimulatedPayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the no-charge notice and sends a server-owned approved request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          outcome: "approved",
          orderId: "order-1",
          orderStatus: "PAID",
          totalCents: 3980,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SimulatedPayment />);

    expect(screen.getByText("Pago simulado — no se ha realizado ningún cargo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pagar de forma simulada" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pago aprobado"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({ outcome: "approved" });
    expect((requestInit.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/.+/u);
    expect(screen.getByRole("link", { name: "Seguir comprando" })).toHaveAttribute("href", "/");
  });

  it("keeps a rejected cart and uses a new key for the retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            outcome: "rejected",
            orderId: "cancelled-1",
            orderStatus: "CANCELLED",
            totalCents: 3980,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            outcome: "approved",
            orderId: "order-2",
            orderStatus: "PAID",
            totalCents: 3980,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<SimulatedPayment />);
    fireEvent.click(screen.getByLabelText("Rechazar pago"));
    fireEvent.click(screen.getByRole("button", { name: "Pagar de forma simulada" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Pago rechazado"));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar pago" }));
    fireEvent.click(screen.getByLabelText("Aprobar pago"));
    fireEvent.click(screen.getByRole("button", { name: "Pagar de forma simulada" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pago aprobado"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstHeaders = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondHeaders = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((firstHeaders.headers as Record<string, string>)["Idempotency-Key"]).not.toBe(
      (secondHeaders.headers as Record<string, string>)["Idempotency-Key"],
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ outcome: "approved" });
  });

  it("keeps the key for a network retry and reports safe errors", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            outcome: "approved",
            orderId: "order-retry",
            orderStatus: "PAID",
            totalCents: 1990,
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<SimulatedPayment />);
    fireEvent.click(screen.getByRole("button", { name: "Pagar de forma simulada" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido conectar"));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar conexión" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pago aprobado"));
    const firstHeaders = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondHeaders = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect((firstHeaders.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      (secondHeaders.headers as Record<string, string>)["Idempotency-Key"],
    );
  });
});

