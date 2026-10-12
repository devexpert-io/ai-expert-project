import { describe, expect, it } from "vitest";

import {
  CHECKOUT_DRAFT_LIMITS,
  CHECKOUT_DRAFT_STORAGE_KEY,
  parseCheckoutDraft,
  serializeCheckoutDraft,
  validateCheckoutDraft,
} from "./checkout";

const validDraft = {
  name: "Ana García",
  email: "ana@example.com",
  phone: "+34 600 123 456",
  shippingAddress: "Calle Mayor 1, 2º B, Madrid",
} as const;

describe("checkout draft", () => {
  it("defines the versioned storage key and accepts the closed valid contract", () => {
    expect(CHECKOUT_DRAFT_STORAGE_KEY).toBe("checkout_draft_v1");
    expect(parseCheckoutDraft(JSON.stringify(validDraft))).toEqual(validDraft);
    expect(serializeCheckoutDraft(validDraft)).toBe(JSON.stringify(validDraft));
  });

  it("normalizes safe whitespace and email casing", () => {
    expect(
      parseCheckoutDraft({
        ...validDraft,
        name: "  Ana   García ",
        email: " ANA@EXAMPLE.COM ",
      }),
    ).toEqual({ ...validDraft, email: "ana@example.com", name: "Ana García" });
  });

  it.each([
    [{ ...validDraft, extra: "reject" }],
    [{ ...validDraft, email: "invalid" }],
    [{ ...validDraft, phone: "abc" }],
    [{ ...validDraft, name: "" }],
    ["not-json"],
    ["null"],
  ])("rejects manipulated or invalid stored data: %j", (value) => {
    expect(parseCheckoutDraft(value)).toBeNull();
  });

  it("returns field errors for empty, invalid and exceeded values", () => {
    const errors = validateCheckoutDraft({
      name: "x".repeat(CHECKOUT_DRAFT_LIMITS.name + 1),
      email: "wrong",
      phone: "12",
      shippingAddress: "x".repeat(CHECKOUT_DRAFT_LIMITS.shippingAddress + 1),
    });

    expect(errors).toEqual({
      name: `El nombre no puede superar ${CHECKOUT_DRAFT_LIMITS.name} caracteres.`,
      email: "Introduce un email válido.",
      phone: "Introduce un teléfono válido.",
      shippingAddress: `La dirección no puede superar ${CHECKOUT_DRAFT_LIMITS.shippingAddress} caracteres.`,
    });
  });
});
