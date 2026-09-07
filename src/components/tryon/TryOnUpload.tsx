"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

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

export function TryOnUpload() {
  const fileInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasValidPhoto, setHasValidPhoto] = useState(false);
  const [consented, setConsented] = useState(false);

  function revokePreview() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      revokePreview();
    };
  }, []);

  function clearPhoto() {
    revokePreview();
    setPreviewUrl(null);
    setError(null);
    setHasValidPhoto(false);
    setConsented(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    revokePreview();
    setPreviewUrl(null);
    setHasValidPhoto(false);
    setConsented(false);

    const result = validateTryonFile(file);
    if (!result.ok || !file) {
      setError(result.ok ? TRYON_ERROR_INVALID : result.message);
      return;
    }

    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    setError(null);
    setHasValidPhoto(true);
  }

  function handleImageError() {
    revokePreview();
    setPreviewUrl(null);
    setHasValidPhoto(false);
    setError(TRYON_ERROR_INVALID);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const status = error
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
        <button className={styles.generate} disabled type="button">
          {TRYON_GENERATE_LABEL}
        </button>
        {previewUrl || error ? (
          <button className={styles.clear} onClick={clearPhoto} type="button">
            {TRYON_CLEAR_LABEL}
          </button>
        ) : null}
      </div>
    </section>
  );
}
