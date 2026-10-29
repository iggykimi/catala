import { useEffect, useRef } from "react";
import { Icon } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A modal confirmation built on the native dialog: Escape cancels, focus is restored. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel·la",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // The cancel event does not bubble, so React cannot delegate it: listen directly.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancelRef.current();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      opener.current?.focus?.();
      opener.current = null;
    };
  }, [open ]);

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="dialog-actions">
        <button ref={cancelRef} className="btn btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="btn btn-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

interface TheoryDialogProps {
  open: boolean;
  html: string;
  onClose: () => void;
}

/** Contextual theory in a native modal dialog: Escape closes, focus is restored to the Teoria button. */
export function TheoryDialog({ open, html, onClose }: TheoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // The cancel event does not bubble, so React cannot delegate it: listen directly.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      opener.current?.focus?.();
      opener.current = null;
    };
  }, [open]);

  return (
    <dialog ref={dialogRef} className="theory-dialog" aria-label="Teoria">
      <button ref={closeRef} className="icon-btn theory-close" onClick={onClose} aria-label="Tanca">
        <Icon name="close" />
      </button>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </dialog>
  );
}
