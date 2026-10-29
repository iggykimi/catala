import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./dialog";
import { localDate, parseProgress, type Progress } from "./progress";

/** Downloads the progress as catala-progres-<date>.json. */
export function downloadProgress(progress: Progress): void {
  const json = JSON.stringify(progress, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `catala-progres-${localDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Catalan restore summary with counts taken from the actual backup data. */
export function importDetails(p: Progress): string {
  const lessons = plural(Object.keys(p.lessons).length, "lliçó completada", "lliçons completades");
  const points = plural(Object.keys(p.cards).length, "punt de repàs", "punts de repàs");
  const days = plural(p.days.length, "dia d'activitat", "dies d'activitat");
  return `Aquesta còpia conté:\n- ${lessons}\n- ${points}\n- ${days}\n\nSe substituirà el progrés actual.\nTambé se suprimirà qualsevol sessió pendent.`;
}

export function importSummary(p: Progress): string {
  return `Restaura el progrés?\n\n${importDetails(p)}`;
}

/** Export to / import from a JSON file. The current progress is never wiped on failure. */
export function Transfer({
  progress,
  replaceProgress,
  registerBack,
}: {
  progress: Progress;
  replaceProgress: (next: Progress) => boolean;
  /** Lets the Android back button close the import dialog instead of leaving settings. */
  registerBack?: (handler: () => boolean) => () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<Progress | null>(null);

  useEffect(() => {
    if (!registerBack) return;
    return registerBack(() => {
      if (pendingImport) {
        setPendingImport(null);
        return true;
      }
      return false;
    });
  }, [registerBack, pendingImport]);

  const lessons = Object.keys(progress.lessons).length;
  const points = Object.keys(progress.cards).length;
  const days = progress.days.length;

  const onFile = async (file: File): Promise<void> => {
    setError(null);
    let parsed: Progress | null;
    try {
      parsed = parseProgress(await file.text());
    } catch {
      parsed = null;
    }
    if (!parsed) {
      setError("Aquest fitxer no és una còpia vàlida.");
      return;
    }
    setPendingImport(parsed);
  };

  return (
    <section className="transfer" aria-label="Transferència del progrés">
      <div className="transfer-actions">
        <button type="button" className="btn btn-secondary" onClick={() => downloadProgress(progress)}>
          Exporta
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
          Importa
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />
      </div>
      <p className="transfer-summary">
        {plural(lessons, "lliçó completada", "lliçons completades")} · {plural(points, "punt de repàs", "punts de repàs")} ·{" "}
        {plural(days, "dia d'activitat", "dies d'activitat")}
      </p>
      {error && (
        <p className="transfer-error" role="alert">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={pendingImport !== null}
        title="Restaura el progrés?"
        description={pendingImport ? importDetails(pendingImport) : ""}
        confirmLabel="Restaura"
        onConfirm={() => {
          if (!pendingImport) return;
          if (replaceProgress(pendingImport)) {
            setPendingImport(null);
            setError(null);
          } else {
            // Close so the failure is visible; the user can pick the file again.
            setPendingImport(null);
            setError("No s'ha pogut restaurar el progrés.");
          }
        }}
        onCancel={() => setPendingImport(null)}
      />
    </section>
  );
}
