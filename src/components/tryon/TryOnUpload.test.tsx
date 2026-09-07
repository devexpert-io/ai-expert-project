import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function makeFile(
  name: string,
  type: string,
  size = 32,
): File {
  return new File([new Uint8Array(size)], name, { type });
}

function getFileInput() {
  return screen.getByLabelText(TRYON_FILE_LABEL, { hidden: true });
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
    render(<TryOnUpload />);

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
    render(<TryOnUpload />);

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
    render(<TryOnUpload />);
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
    render(<TryOnUpload />);
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
    render(<TryOnUpload />);

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile("roto.webp", "image/webp")] },
    });
    fireEvent.error(screen.getByAltText(TRYON_PREVIEW_ALT));

    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(TRYON_ERROR_INVALID);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tryon-preview");
  });

  it("keeps generate disabled after consent and does not send the photo", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    render(<TryOnUpload />);
    fireEvent.change(getFileInput(), {
      target: { files: [makeFile("foto.jpg", "image/jpeg")] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: TRYON_CONSENT_LABEL }));

    expect(screen.getByRole("status")).toHaveTextContent(TRYON_STATUS_READY);
    expect(
      screen.getByRole("button", { name: TRYON_GENERATE_LABEL }),
    ).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("clears the preview, consent and input when removing the photo", () => {
    render(<TryOnUpload />);
    const input = getFileInput() as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [makeFile("foto.jpg", "image/jpeg")] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: TRYON_CONSENT_LABEL }));
    fireEvent.click(screen.getByRole("button", { name: TRYON_CLEAR_LABEL }));

    expect(screen.queryByAltText(TRYON_PREVIEW_ALT)).not.toBeInTheDocument();
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

  it("revokes the object URL when the section unmounts", () => {
    const { unmount } = render(<TryOnUpload />);

    fireEvent.change(getFileInput(), {
      target: { files: [makeFile("foto.jpg", "image/jpeg")] },
    });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:tryon-preview");
  });
});
