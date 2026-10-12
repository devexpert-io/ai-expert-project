import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Server-only modules are imported by route handlers during unit tests; the
// boundary is enforced by Next.js in the application build.
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
