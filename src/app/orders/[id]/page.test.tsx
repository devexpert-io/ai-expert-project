import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const redirectMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
const getUserOrderDetail = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));
vi.mock("../../../lib/server/auth", () => ({ getSessionUser }));
vi.mock("../../../lib/server/order-detail", () => ({ getUserOrderDetail }));

import OrderDetailPage from "./page";

const order = {
  status: "PAID",
  totalCents: 6470,
  createdAt: new Date("2026-10-12T10:00:00.000Z"),
  lines: [
    {
      productName: "Camiseta básica histórica",
      size: "S",
      color: "Negro",
      quantity: 2,
      unitPriceCents: 1990,
      lineTotalCents: 3980,
    },
    {
      productName: "Pantalón recto histórico",
      size: "M",
      color: "Azul",
      quantity: 1,
      unitPriceCents: 2490,
      lineTotalCents: 2490,
    },
  ],
} as const;

function redirectTo(path: string): never {
  throw new Error(`NEXT_REDIRECT:${path}`);
}

function notFoundToError(): never {
  throw new Error("NEXT_NOT_FOUND");
}

describe("/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation(redirectTo);
    notFoundMock.mockImplementation(notFoundToError);
    cookieStore.get.mockReturnValue({ value: "session-a" });
    cookiesMock.mockResolvedValue(cookieStore);
    getSessionUser.mockResolvedValue({ id: "user-a" });
    getUserOrderDetail.mockResolvedValue(order);
  });

  it("requires a session before reading an order", async () => {
    cookieStore.get.mockReturnValue(undefined);

    await expect(
      OrderDetailPage({ params: Promise.resolve({ id: "order-a" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/checkout");

    expect(getSessionUser).not.toHaveBeenCalled();
    expect(getUserOrderDetail).not.toHaveBeenCalled();
  });

  it("redirects an invalid session before the owner-scoped detail query", async () => {
    getSessionUser.mockResolvedValueOnce(null);

    await expect(
      OrderDetailPage({ params: Promise.resolve({ id: "order-a" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/checkout");

    expect(getSessionUser).toHaveBeenCalledWith("session-a");
    expect(getUserOrderDetail).not.toHaveBeenCalled();
  });

  it("renders historical lines, supported state, totals, date and return link without the id", async () => {
    render(
      await OrderDetailPage({ params: Promise.resolve({ id: "order-a" }) }),
    );

    expect(getSessionUser).toHaveBeenCalledWith("session-a");
    expect(getUserOrderDetail).toHaveBeenCalledWith("user-a", "order-a");
    expect(screen.getByRole("heading", { name: "Detalle del pedido" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a Mis pedidos" })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(screen.getByRole("list", { name: "Líneas del pedido" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByText("Pagado")).toHaveLength(1);
    expect(screen.getByText("Camiseta básica histórica")).toBeInTheDocument();
    expect(screen.getByText("Pantalón recto histórico")).toBeInTheDocument();
    expect(screen.getAllByText("Talla")[0]?.parentElement).toHaveTextContent("S");
    expect(screen.getByText(/39,80/u)).toBeInTheDocument();
    expect(screen.getAllByText(/24,90/u)).toHaveLength(2);
    expect(screen.getByText("12 oct 2026")).toBeInTheDocument();
    expect(screen.getAllByText(/64,70/u)).toHaveLength(2);
    expect(screen.queryByText("order-a")).not.toBeInTheDocument();
    expect(screen.queryByText("user-a")).not.toBeInTheDocument();
  });

  it("uses one indistinguishable notFound path for a missing or foreign order", async () => {
    getUserOrderDetail.mockResolvedValueOnce(null);

    await expect(
      OrderDetailPage({ params: Promise.resolve({ id: "order-foreign" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getUserOrderDetail).toHaveBeenCalledWith("user-a", "order-foreign");

    notFoundMock.mockClear();
    getUserOrderDetail.mockResolvedValueOnce(null);

    await expect(
      OrderDetailPage({ params: Promise.resolve({ id: "order-missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledOnce();
    expect(getUserOrderDetail).toHaveBeenCalledWith("user-a", "order-missing");
  });
});

