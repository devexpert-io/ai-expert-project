"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import {
  TRYON_APPROXIMATION_NOTICE,
  TRYON_RESULT_ALT,
  TRYON_STATUS_GENERATING,
  TRYON_UNAVAILABLE,
  isTryonImageDataUrl,
} from "../../lib/tryon";
import {
  TRYON_ACCEPT,
  TRYON_CLEAR_LABEL,
  TRYON_CONSENT_LABEL,
  TRYON_ERROR_INVALID,
  TRYON_FILE_LABEL,
  TRYON_GENERATE_LABEL,
  TRYON_PREVIEW_ALT,
  TRYON_PRIVACY_NOTICE,
  TRYON_STATUS_READY,
  TRYON_STATUS_VALID,
  validateTryonFile,
} from "../../lib/tryon-upload";

import styles from "./tryon-upload.module.css";

type TryOnUploadProps = Readonly<{
  productSlug: string;
  size?: string | null;
  color?: string | null;
}>;

export function TryOnUpload({
  productSlug,
  size = null,
  color = null,
}: TryOnUploadProps) {
  const fileInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasValidPhoto, setHasValidPhoto] = useState(false);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function revokePreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  function cancelRequest() {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setSubmitting(false);
  }

  useEffect(() => {
    return () => {
      revokePreview();
      abortRef.current?.abort();
    };
  }, []);

  function clearPhoto() {
    cancelRequest();
    revokePreview();
    fileRef.current = null;
    setPreviewUrl(null);
    setResultUrl(null);
    setError(null);
    setHasValidPhoto(false);
    setConsented(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    cancelRequest();
    revokePreview();
    fileRef.current = null;
    setPreviewUrl(null);
    setResultUrl(null);
    setHasValidPhoto(false);
    setConsented(false);

    const result = validateTryonFile(file);
    if (!result.ok || !file) {
      setError(result.ok ? TRYON_ERROR_INVALID : result.message);
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    fileRef.current = file;
    setPreviewUrl(url);
    setError(null);
    setHasValidPhoto(true);
  }

  function handleImageError() {
    cancelRequest();
    revokePreview();
    fileRef.current = null;
    setPreviewUrl(null);
    setResultUrl(null);
    setHasValidPhoto(false);
    setError(TRYON_ERROR_INVALID);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleGenerate() {
    const file = fileRef.current;
    if (!file || !hasValidPhoto || !consented || submitting) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    setSubmitting(true);
    setError(null);
    setResultUrl(null);

    const body = new FormData();
    body.append("photo", file);
    body.append("productSlug", productSlug);
    body.append("consent", "true");
    if (size) {
      body.append("size", size);
    }
    if (color) {
      body.append("color", color);
    }

    try {
      const response = await fetch("/api/tryon", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (requestId !== requestIdRef.current || controller.signal.aborted) {
        return;
      }

      if (
        response.ok &&
        payload &&
        typeof payload === "object" &&
        "ok" in payload &&
        payload.ok === true &&
        "imageDataUrl" in payload &&
        isTryonImageDataUrl(payload.imageDataUrl)
      ) {
        setResultUrl(payload.imageDataUrl);
        return;
      }

      const message =
        payload &&
        typeof payload === "object" &&
        "ok" in payload &&
        payload.ok === false &&
        "message" in payload &&
        typeof payload.message === "string"
          ? payload.message
          : TRYON_UNAVAILABLE;
      setError(message);
    } catch {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setError(TRYON_UNAVAILABLE);
      }
    } finally {
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setSubmitting(false);
        abortRef.current = null;
      }
    }
  }

  const canGenerate = hasValidPhoto && consented && !submitting;
  const status = submitting
    ? TRYON_STATUS_GENERATING
    : error
      ? error
      : hasValidPhoto && consented
        ? TRYON_STATUS_READY
        : hasValidPhoto
          ? TRYON_STATUS_VALID
          : null;

  return (
    <section aria-labelledby="tryon-heading" className={styles.section}>
      <h2 className={styles.title} id="tryon-heading">
        Prueba virtual
      </h2>
      <p className={styles.privacy}>{TRYON_PRIVACY_NOTICE}</p>

      <div className={styles.picker}>
        <input
          accept={TRYON_ACCEPT}
          aria-label={TRYON_FILE_LABEL}
          className={styles.fileInput}
          id={fileInputId}
          onChange={handleFileChange}
          ref={inputRef}
          type="file"
        />
        <label className={styles.dropzone} htmlFor={fileInputId}>
          <span className={styles.dropzoneTitle}>{TRYON_FILE_LABEL}</span>
          <span aria-hidden="true" className={styles.dropzoneHint}>
            JPG, PNG o WebP · máximo 5 MB
          </span>
        </label>
      </div>

      {previewUrl ? (
        <div className={styles.previewFrame}>
          {/* Object URLs are local and revoked; next/image cannot own that lifecycle. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={TRYON_PREVIEW_ALT}
            className={styles.preview}
            onError={handleImageError}
            src={previewUrl}
          />
        </div>
      ) : null}

      {resultUrl ? (
        <div className={styles.previewFrame}>
          {/* Generated data URLs are ephemeral in memory; next/image cannot own that. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={TRYON_RESULT_ALT} className={styles.preview} src={resultUrl} />
        </div>
      ) : null}

      {resultUrl ? (
        <p className={styles.approximation}>{TRYON_APPROXIMATION_NOTICE}</p>
      ) : null}

      {status ? (
        <p
          aria-live="polite"
          className={
            error
              ? `${styles.status} ${styles.error}`
              : `${styles.status} ${styles.success}`
          }
          role="status"
        >
          {status}
        </p>
      ) : null}

      <label className={styles.consent}>
        <input
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
          type="checkbox"
        />
        <span>{TRYON_CONSENT_LABEL}</span>
      </label>

      <div className={styles.actions}>
        <button
          className={styles.generate}
          disabled={!canGenerate}
          onClick={handleGenerate}
          type="button"
        >
          {TRYON_GENERATE_LABEL}
        </button>
        {previewUrl || error || resultUrl ? (
          <button className={styles.clear} onClick={clearPhoto} type="button">
            {TRYON_CLEAR_LABEL}
          </button>
        ) : null}
      </div>
    </section>
  );
}
