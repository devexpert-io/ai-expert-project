import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TRYON_APPROXIMATION_NOTICE,
  TRYON_RESULT_ALT,
  TRYON_STATUS_GENERATING,
  TRYON_UNAVAILABLE,
} from "../../lib/tryon";
import {
  TRYON_ACCEPT,
  TRYON_CLEAR_LABEL,
  TRYON_CONSENT_LABEL,
  TRYON_ERROR_INVALID,
  TRYON_ERROR_SIZE,
  TRYON_ERROR_TYPE,
  TRYON_FILE_LABEL,
  TRYON_GENERATE_LABEL,
  TRYON_MAX_BYTES,
  TRYON_PREVIEW_ALT,
  TRYON_PRIVACY_NOTICE,
  TRYON_STATUS_READY,
  TRYON_STATUS_VALID,
} from "../../lib/tryon-upload";

import { TryOnUpload } from "./TryOnUpload";

const RESULT_URL = "data:image/png;base64,iVBORw0KGgo=";

function makeFile(name: string, type: string, size = 32): File {
  return new File([new Uint8Array(size)], name, { type });
}

function getFileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("missing try-on file input");
  }
  expect(input).toHaveAttribute("aria-label", TRYON_FILE_LABEL);
  return input;
}

function renderUpload(
  props: { productSlug?: string; size?: string | null; color?: string | null } = {},
) {
  return render(
    <TryOnUpload
      color={props.color ?? null}
      productSlug={props.productSlug ?? "camiseta-basica"}
      size={props.size ?? null}
    />,
  );
}

function readyPhoto() {
  fireEvent.change(getFileInput(), {
    target: { files: [makeFile("foto.jpg", "image/jpeg")] },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: TRYON_CONSENT_LABEL }));
}

describe("TryOnUpload", () => {
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

  it("renders the labeled upload, privacy notice and a disabled generate control", () => {
    renderUpload();

    expect(
      screen.getByRole("heading", { level: 2, name: "Prueba virtual" }),
    ).toBeInTheDocument();
    expect(getFileInput()).toHaveAttribute("accept", TRYON_ACCEPT);
    expect(screen.getByText(TRYON_PRIVACY_NOTICE)).toBeInTheDocument();
    expect(screen.getByText(/dato personal/i)).toBeInTheDocument();
    expect(screen.getByText(/inference\.devexpert\.io/i)).toBeInTheDocument();
    expect(screen.getByText(/no se guarda en la tienda/i)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: TRYON_CONSENT_LABEL }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: TRYON_GENERATE_LABEL }),
    ).toBeDisabled();
    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a local preview and valid status for an allowed image", () => {
    renderUpload();

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile("foto.jpg", "image/jpeg")] },
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(screen.getByAltText(TRYON_PREVIEW_ALT)).toHaveAttribute(
      "src",
      "blob:tryon-preview",
    );
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_STATUS_VALID);
    expect(screen.queryByText(TRYON_ERROR_TYPE)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: TRYON_GENERATE_LABEL }),
    ).toBeDisabled();
  });

  it("announces constant errors and skips preview for invalid files", () => {
    renderUpload();
    const input = getFileInput();

    fireEvent.change(input, {
      target: { files: [makeFile("foto.heic", "image/heic")] },
    });
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_TYPE);

    fireEvent.change(input, {
      target: { files: [makeFile("foto.gif", "image/gif")] },
    });
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_TYPE);

    fireEvent.change(input, {
      target: { files: [makeFile("foto.svg", "image/svg+xml")] },
    });
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_TYPE);

    fireEvent.change(input, {
      target: { files: [makeFile("doc.pdf", "application/pdf")] },
    });
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_TYPE);

    fireEvent.change(input, {
      target: { files: [makeFile("vacio.jpg", "image/jpeg", 0)] },
    });
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_INVALID);

    fireEvent.change(input, {
      target: {
        files: [makeFile("grande.jpg", "image/jpeg", TRYON_MAX_BYTES + 1)],
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_SIZE);
    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("revokes a previous preview when the next file is invalid", () => {
    renderUpload();
    const input = getFileInput();

    fireEvent.change(input, {
      target: { files: [makeFile("foto.png", "image/png")] },
    });
    expect(screen.getByAltText(TRYON_PREVIEW_ALT)).toBeInTheDocument();

    fireEvent.change(input, {
      target: { files: [makeFile("foto.gif", "image/gif")] },
    });

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tryon-preview");
    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_TYPE);
  });

  it("treats an undecodable image as invalid and revokes the object URL", () => {
    renderUpload();

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile("roto.webp", "image/webp")] },
    });
    fireEvent.error(screen.getByAltText(TRYON_PREVIEW_ALT));

    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_INVALID);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tryon-preview");
  });

  it("enables generate after consent and sends the current selection", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, imageDataUrl: RESULT_URL }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    renderUpload({ size: "S", color: "Negro" });
    readyPhoto();

    expect(screen.getByRole("status")).toHaveTextContent(TRYON_STATUS_READY);
    const generate = screen.getByRole("button", { name: TRYON_GENERATE_LABEL });
    expect(generate).toBeEnabled();

    fireEvent.click(generate);

    await waitFor(() => {
      expect(screen.getByAltText(TRYON_RESULT_ALT)).toHaveAttribute(
        "src",
        RESULT_URL,
      );
    });
    expect(screen.getByText(TRYON_APPROXIMATION_NOTICE)).toBeInTheDocument();
    expect(screen.getByAltText(TRYON_PREVIEW_ALT)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tryon");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("productSlug")).toBe("camiseta-basica");
    expect(body.get("consent")).toBe("true");
    expect(body.get("size")).toBe("S");
    expect(body.get("color")).toBe("Negro");
    expect(body.get("photo")).toBeInstanceOf(File);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("announces processing, disables the button and blocks a second fetch", async () => {
    let resolveRequest!: (value: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderUpload();
    readyPhoto();
    const generate = screen.getByRole("button", { name: TRYON_GENERATE_LABEL });
    fireEvent.click(generate);
    fireEvent.click(generate);

    expect(screen.getByRole("status")).toHaveTextContent(TRYON_STATUS_GENERATING);
    expect(generate).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveRequest({
      ok: true,
      json: async () => ({ ok: true, imageDataUrl: RESULT_URL }),
    });
    await waitFor(() => {
      expect(screen.getByAltText(TRYON_RESULT_ALT)).toBeInTheDocument();
    });
  });

  it("keeps the preview and allows retry after a controlled error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        message: "El cupo semanal de IA está agotado. Inténtalo de nuevo más tarde.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderUpload();
    readyPhoto();
    fireEvent.click(screen.getByRole("button", { name: TRYON_GENERATE_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("cupo semanal");
    });
    expect(screen.getByAltText(TRYON_PREVIEW_ALT)).toBeInTheDocument();
    expect(screen.queryByAltText(TRYON_RESULT_ALT)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: TRYON_GENERATE_LABEL }),
    ).toBeEnabled();
    expect(screen.queryByText(/stack|DEVEXPERT_API_KEY/i)).not.toBeInTheDocument();
  });

  it("shows a safe fallback when the response is malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, imageDataUrl: "https://evil.example/x.png" }),
      }),
    );

    renderUpload();
    readyPhoto();
    fireEvent.click(screen.getByRole("button", { name: TRYON_GENERATE_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(TRYON_UNAVAILABLE);
    });
    expect(screen.queryByAltText(TRYON_RESULT_ALT)).not.toBeInTheDocument();
  });

  it("clears preview, result, consent and aborts an in-flight request", async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );

    renderUpload();
    const input = getFileInput() as HTMLInputElement;
    readyPhoto();
    fireEvent.click(screen.getByRole("button", { name: TRYON_GENERATE_LABEL }));
    fireEvent.click(screen.getByRole("button", { name: TRYON_CLEAR_LABEL }));

    expect(abortSpy).toHaveBeenCalled();
    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
    expect(screen.queryByAltText(TRYON_RESULT_ALT)).not.toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tryon-preview");
    expect(
      screen.getByRole("checkbox", { name: TRYON_CONSENT_LABEL }),
    ).not.toBeChecked();
    expect(input.value).toBe("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: TRYON_CLEAR_LABEL }),
    ).not.toBeInTheDocument();
  });

  it("revokes the object URL and aborts when the section unmounts", () => {
    const abortSpy = vi.spyOn(AbortController.prototype, "abort");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    const { unmount } = renderUpload();

    readyPhoto();
    fireEvent.click(screen.getByRole("button", { name: TRYON_GENERATE_LABEL }));
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tryon-preview");
    expect(abortSpy).toHaveBeenCalled();
  });
});
