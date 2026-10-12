import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.hoisted(() => vi.fn());
const cookieStore = vi.hoisted(() => ({ get: vi.fn() }));
const redirectMock = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
const getUserOrders = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("../../lib/server/auth", () => ({ getSessionUser }));
vi.mock("../../lib/server/orders", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/orders")>(
    "../../lib/server/orders",
  );
  return { ...actual, getUserOrders };
});

import OrdersPage from "./page";

const orders = [
  {
    id: "order-paid",
    status: "PAID",
    totalCents: 3980,
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
  },
  {
    id: "order-cancelled",
    status: "CANCELLED",
    totalCents: 2490,
    createdAt: new Date("2026-10-11T10:00:00.000Z"),
  },
  {
    id: "order-pending",
    status: "PENDING_PAYMENT",
    totalCents: 1990,
    createdAt: new Date("2026-10-10T10:00:00.000Z"),
  },
  {
    id: "order-unknown",
    status: "INTERNAL_ONLY",
    totalCents: 9999,
    createdAt: new Date("2026-10-09T10:00:00.000Z"),
  },
] as const;

function redirectTo(path: string): never {
  throw new Error(`NEXT_REDIRECT:${path}`);
}

describe("/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation(redirectTo);
    cookieStore.get.mockReturnValue({ value: "session-a" });
    cookiesMock.mockResolvedValue(cookieStore);
    getSessionUser.mockResolvedValue({ id: "user-a" });
    getUserOrders.mockResolvedValue(orders);
  });

  it("requires a session before querying the authenticated user's orders", async () => {
    cookieStore.get.mockReturnValue(undefined);

    await expect(OrdersPage()).rejects.toThrow("NEXT_REDIRECT:/checkout");

    expect(getSessionUser).not.toHaveBeenCalled();
    expect(getUserOrders).not.toHaveBeenCalled();
  });

  it("redirects an invalid session before reading any order", async () => {
    getSessionUser.mockResolvedValueOnce(null);

    await expect(OrdersPage()).rejects.toThrow("NEXT_REDIRECT:/checkout");

    expect(getSessionUser).toHaveBeenCalledWith("session-a");
    expect(getUserOrders).not.toHaveBeenCalled();
  });

  it("renders the three supported states, totals and Madrid dates without exposing ids or unknown states", async () => {
    render(await OrdersPage());

    expect(getSessionUser).toHaveBeenCalledWith("session-a");
    expect(getUserOrders).toHaveBeenCalledWith("user-a");
    expect(screen.getByRole("heading", { name: "Mis pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Pedidos" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("Pagado")).toHaveLength(2);
    expect(screen.getAllByText("Cancelado")).toHaveLength(2);
    expect(screen.getAllByText("Pendiente de pago")).toHaveLength(2);
    const detailLinks = screen.getAllByRole("link", { name: "Ver detalle del pedido" });
    expect(detailLinks).toHaveLength(3);
    expect(detailLinks[0]).toHaveAttribute(
      "href",
      "/orders/order-paid",
    );
    expect(screen.getByText(/39,80/u)).toBeInTheDocument();
    expect(screen.getByText(/24,90/u)).toBeInTheDocument();
    expect(screen.getByText(/19,90/u)).toBeInTheDocument();
    expect(screen.getByText("12 oct 2026")).toBeInTheDocument();
    expect(screen.getByText("11 oct 2026")).toBeInTheDocument();
    expect(screen.getByText("10 oct 2026")).toBeInTheDocument();
    expect(screen.queryByText("INTERNAL_ONLY")).not.toBeInTheDocument();
    expect(screen.queryByText("order-paid")).not.toBeInTheDocument();
    expect(screen.queryByText("user-a")).not.toBeInTheDocument();
  });

  it("shows the accessible empty state and catalog link", async () => {
    getUserOrders.mockResolvedValueOnce([]);

    render(await OrdersPage());

    expect(screen.getByRole("status")).toHaveTextContent("Aún no tienes pedidos");
    expect(screen.getByRole("link", { name: "Explorar catálogo" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("list", { name: "Pedidos" })).not.toBeInTheDocument();
  });
});
