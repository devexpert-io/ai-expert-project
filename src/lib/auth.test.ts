import { describe, expect, it } from "vitest";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  PASSWORD_MAX_BYTES,
  parseAuthInput,
  serializeAuthCookie,
  serializeExpiredAuthCookie,
  validatePassword,
} from "./auth";

const valid = {
  mode: "register",
  email: " Ana@Example.com ",
  password: "correct horse battery",
  name: " Ana García ",
  phone: "+34 600 123 456",
  shippingAddress: "Calle Mayor 1\r\nMadrid",
} as const;

describe("checkout auth contract", () => {
  it("normalizes contact fields while preserving password only in memory", () => {
    expect(parseAuthInput(valid)).toEqual({
      mode: "register",
      email: "ana@example.com",
      password: valid.password,
      name: "Ana García",
      phone: "+34 600 123 456",
      shippingAddress: "Calle Mayor 1\nMadrid",
    });
  });

  it.each([
    { ...valid, extra: true },
    { ...valid, password: "short" },
    { ...valid, password: "a".repeat(69) + "😀" },
    { ...valid, email: "not-an-email" },
  ])("rejects a closed or invalid auth body %#", (input) => {
    expect(parseAuthInput(input)).toBeNull();
  });

  it("rejects passwords over bcrypt's UTF-8 byte limit without truncating", () => {
    const password = "a".repeat(PASSWORD_MAX_BYTES - 7) + "😀😀";
    expect(new TextEncoder().encode(password).byteLength).toBeGreaterThan(
      PASSWORD_MAX_BYTES,
    );
    expect(validatePassword(password)).toBe("La contraseña es demasiado larga.");
    expect(parseAuthInput({ ...valid, password })).toBeNull();
  });

  it("serializes opaque HttpOnly cookies with the required lifetime", () => {
    expect(serializeAuthCookie("raw-token", false)).toBe(
      `${AUTH_COOKIE_NAME}=raw-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}`,
    );
    expect(serializeExpiredAuthCookie(false)).toContain(`${AUTH_COOKIE_NAME}=;`);
    expect(serializeExpiredAuthCookie(false)).toContain("Max-Age=0");
  });
});
