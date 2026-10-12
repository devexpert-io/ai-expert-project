import { describe, expect, it } from "vitest";

import { CART_QUANTITY_MAX, parseCartAddInput } from "./cart";

describe("parseCartAddInput", () => {
  it("accepts exactly a variant id and a positive safe integer", () => {
    expect(
      parseCartAddInput({ variantId: "  variant-s-black ", quantity: 2 }),
    ).toEqual({ variantId: "variant-s-black", quantity: 2 });
    expect(
      parseCartAddInput({ variantId: "variant-s-black", quantity: CART_QUANTITY_MAX }),
    ).toEqual({ variantId: "variant-s-black", quantity: CART_QUANTITY_MAX });
  });

  it.each([
    null,
    [],
    {},
    { variantId: "variant-s-black" },
    { quantity: 1 },
    { variantId: "variant-s-black", quantity: 1, priceCents: 1990 },
    { variantId: "", quantity: 1 },
    { variantId: "   ", quantity: 1 },
    { variantId: 123, quantity: 1 },
    { variantId: "variant-s-black", quantity: 0 },
    { variantId: "variant-s-black", quantity: -1 },
    { variantId: "variant-s-black", quantity: 1.5 },
    { variantId: "variant-s-black", quantity: CART_QUANTITY_MAX + 1 },
    { variantId: "variant-s-black", quantity: Number.MAX_SAFE_INTEGER + 1 },
    { variantId: "variant-s-black", quantity: "2" },
  ])("rejects untrusted input %#", (value) => {
    expect(parseCartAddInput(value)).toBeNull();
  });
});
