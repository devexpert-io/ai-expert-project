import { describe, expect, it } from "vitest";

import {
  PAYMENT_KEY_MAX_LENGTH,
  parseIdempotencyKey,
  parsePaymentInput,
} from "./payment";

describe("payment contracts", () => {
  it("accepts only the closed approved/rejected body", () => {
    expect(parsePaymentInput({ outcome: "approved" })).toEqual({ outcome: "approved" });
    expect(parsePaymentInput({ outcome: "rejected" })).toEqual({ outcome: "rejected" });
    expect(parsePaymentInput({ outcome: "approved", totalCents: 10 })).toBeNull();
    expect(parsePaymentInput({ outcome: "unknown" })).toBeNull();
    expect(parsePaymentInput(null)).toBeNull();
  });

  it("requires a bounded visible ASCII idempotency key", () => {
    expect(parseIdempotencyKey("payment-1")).toBe("payment-1");
    expect(parseIdempotencyKey("")).toBeNull();
    expect(parseIdempotencyKey("has space")).toBeNull();
    expect(parseIdempotencyKey("á"))
      .toBeNull();
    expect(parseIdempotencyKey("x".repeat(PAYMENT_KEY_MAX_LENGTH + 1))).toBeNull();
    expect(parseIdempotencyKey("\nkey")).toBeNull();
  });
});

