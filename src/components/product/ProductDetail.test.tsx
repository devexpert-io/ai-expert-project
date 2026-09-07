import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    sizes,
    alt,
    ...props
  }: {
    alt: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    src: string;
  }) => {
    void fill;
    void priority;
    void sizes;
    return createElement("img", { ...props, alt });
  },
}));

import ProductDetail from "./ProductDetail";

const product = {
  id: "product-1",
  slug: "camiseta-basica",
  name: "Camiseta básica",
  description: "Camiseta de algodón suave.",
  imageUrl: "https://placehold.co/image.png",
  basePriceCents: 1990,
  categoryName: "Camisetas",
  variants: [
    {
      id: "variant-s-black",
      size: "S",
      color: "Negro",
      stock: 12,
      priceCents: 1990,
    },
    {
      id: "variant-m-black",
      size: "M",
      color: "Negro",
      stock: 0,
      priceCents: 1990,
    },
    {
      id: "variant-xl-blue",
      size: "XL",
      color: "Azul",
      stock: 5,
      priceCents: 2090,
    },
  ],
} as const;

function getTryOnFileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("missing try-on file input");
  }
  return input;
}

describe("ProductDetail", () => {
  const createObjectURL = vi.fn(() => "blob:tryon-preview");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the product and a native GET variant form", () => {
    render(
      <ProductDetail
        product={product}
        selection={{
          size: null,
          color: null,
          variant: null,
          hasInvalidValue: false,
          hasInvalidCombination: false,
        }}
      />,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Camiseta básica" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Camisetas")).toBeInTheDocument();
    expect(screen.getByText("Camiseta de algodón suave.")).toBeInTheDocument();
    expect(screen.getByAltText("Imagen de Camiseta básica")).toBeInTheDocument();
    expect(screen.getByText(/19,90\s*€/u)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Talla" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Color" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consultar variante" }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Selector de variante" }),
    ).toHaveAttribute(
      "action",
      "/products/camiseta-basica",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Prueba virtual" }),
    ).toBeInTheDocument();
    expect(getTryOnFileInput()).toHaveAttribute("aria-label", "Elige una foto");
    expect(screen.getByText(/inference\.devexpert\.io/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generar prueba virtual" }),
    ).toBeDisabled();
    expect(screen.queryByText(/carrito/iu)).not.toBeInTheDocument();
    expect(ProductDetail.toString()).not.toMatch(/use client/i);
  });

  it("enables try-on generation with the URL-backed slug and selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProductDetail
        product={product}
        selection={{
          size: "XL",
          color: "Azul",
          variant: product.variants[2],
          hasInvalidValue: false,
          hasInvalidCombination: false,
        }}
      />,
    );

    fireEvent.change(getTryOnFileInput(), {
      target: {
        files: [new File([new Uint8Array(32)], "foto.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Entiendo que mi foto se enviará al proveedor de IA",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Generar prueba virtual" }),
    );

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tryon");
    expect(body.get("productSlug")).toBe("camiseta-basica");
    expect(body.get("size")).toBe("XL");
    expect(body.get("color")).toBe("Azul");
    expect(body.get("consent")).toBe("true");
  });

  it("shows exact price and available stock for a selected variant", () => {
    render(
      <ProductDetail
        product={product}
        selection={{
          size: "XL",
          color: "Azul",
          variant: product.variants[2],
          hasInvalidValue: false,
          hasInvalidCombination: false,
        }}
      />,
    );

    expect(screen.getByText(/20,90\s*€/u)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Disponible · 5 unidades",
    );
    expect(screen.getByRole("radio", { name: "XL" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
  });

  it("keeps a sold-out direct selection visible and disabled", () => {
    render(
      <ProductDetail
        product={product}
        selection={{
          size: "M",
          color: "Negro",
          variant: product.variants[1],
          hasInvalidValue: false,
          hasInvalidCombination: false,
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Agotada · 0 unidades",
    );
    expect(screen.getByRole("radio", { name: /M.*Agotada/u })).toBeDisabled();
    expect(
      screen.getByRole("radio", { name: /Negro.*Agotada/u }),
    ).toBeDisabled();
  });

  it("explains partial and nonexistent combinations without stock", () => {
    const { rerender } = render(
      <ProductDetail
        product={product}
        selection={{
          size: "S",
          color: null,
          variant: null,
          hasInvalidValue: false,
          hasInvalidCombination: false,
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Talla S seleccionada. Elige un color.",
    );

    rerender(
      <ProductDetail
        product={product}
        selection={{
          size: "S",
          color: "Azul",
          variant: null,
          hasInvalidValue: false,
          hasInvalidCombination: true,
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Esa combinación de talla y color no existe.",
    );
    expect(screen.getByRole("radio", { name: "S" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Azul" })).toBeEnabled();
  });
});
