import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MAX_PDF_BYTES, type Provider, type ReviewSuccess } from "../shared/types";
import { ApiTransportError, submitReview } from "./api";
import { CriteriaField } from "./components/CriteriaField";
import { ElapsedTimer, ErrorBanner } from "./components/Banners";
import { ProviderSection } from "./components/ProviderSection";
import { ResultsCard } from "./components/ResultsCard";
import { SpinnerIcon } from "./components/icons";
import { UploadField } from "./components/UploadField";

type Phase =
  | { kind: "idle" }
  | { kind: "submitting"; startedAt: number }
  | { kind: "result"; data: ReviewSuccess }
  | { kind: "error"; message: string };

type FieldKey = "file" | "criteria" | "apiKey" | "model";
type FieldErrors = Partial<Record<FieldKey, string>>;

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [criteria, setCriteria] = useState("");
  const [provider, setProvider] = useState<Provider>("openrouter");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("");
  const [ollamaEndpoint, setOllamaEndpoint] = useState("");
  const [ollamaModel, setOllamaModel] = useState("");
  const [verifierOverride, setVerifierOverride] = useState("");

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const outcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase.kind === "result" || phase.kind === "error") {
      outcomeRef.current?.focus();
    }
  }, [phase]);

  const setFieldError = useCallback((key: FieldKey, message: string | null) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message === null) delete next[key];
      else next[key] = message;
      return next;
    });
  }, []);

  const handleFileSelect = useCallback(
    (selected: File | null) => {
      setFile(selected);
      setFieldError("file", null);
    },
    [setFieldError],
  );

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (file === null) errors.file = "Upload a resume PDF to review.";
    if (criteria.trim() === "") errors.criteria = "Enter at least one hiring criterion.";
    if (provider === "openrouter") {
      if (openrouterApiKey.trim() === "") errors.apiKey = "An OpenRouter API key is required.";
      if (openrouterModel.trim() === "") errors.model = "Enter a model name.";
    } else if (ollamaModel.trim() === "") {
      errors.model = "Enter a model name.";
    }
    return errors;
  };

  const submitting = phase.kind === "submitting";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    const errors = validate();
    setFieldErrors(errors);
    if (file === null || Object.keys(errors).length > 0) return;

    setPhase({ kind: "submitting", startedAt: Date.now() });
    try {
      const response = await submitReview({
        file,
        criteria: criteria.trim(),
        provider,
        ...(provider === "openrouter"
          ? { openrouterApiKey: openrouterApiKey.trim(), openrouterModel: openrouterModel.trim() }
          : {
              ...(ollamaEndpoint.trim() !== "" ? { ollamaEndpoint: ollamaEndpoint.trim() } : {}),
              ollamaModel: ollamaModel.trim(),
            }),
        ...(verifierOverride.trim() !== "" ? { verifierModelOverride: verifierOverride.trim() } : {}),
      });
      if (response.status === "ok") {
        setPhase({ kind: "result", data: response });
      } else {
        setPhase({ kind: "error", message: response.error.message });
      }
    } catch (err) {
      setPhase({
        kind: "error",
        message:
          err instanceof ApiTransportError || err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      });
    }
  };

  const statusText =
    phase.kind === "result"
      ? "Assessment ready."
      : phase.kind === "error"
        ? `Review failed: ${phase.message}`
        : "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
            A
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">APAR</h1>
            <p className="text-xs text-slate-400">AI Powered Applicant Review</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <p aria-live="polite" role="status" className="sr-only">
          {statusText}
        </p>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <UploadField
            file={file}
            disabled={submitting}
            onSelect={handleFileSelect}
            error={fieldErrors.file}
            onErrorChange={(msg) => setFieldError("file", msg)}
          />

          <CriteriaField
            value={criteria}
            disabled={submitting}
            onChange={setCriteria}
            error={fieldErrors.criteria}
          />

          <ProviderSection
            provider={provider}
            onProviderChange={setProvider}
            openrouterApiKey={openrouterApiKey}
            onOpenrouterApiKeyChange={setOpenrouterApiKey}
            openrouterModel={openrouterModel}
            onOpenrouterModelChange={setOpenrouterModel}
            ollamaEndpoint={ollamaEndpoint}
            onOllamaEndpointChange={setOllamaEndpoint}
            ollamaModel={ollamaModel}
            onOllamaModelChange={setOllamaModel}
            verifierOverride={verifierOverride}
            onVerifierOverrideChange={setVerifierOverride}
            apiKeyError={fieldErrors.apiKey}
            modelError={fieldErrors.model}
            disabled={submitting}
          />

          <div className="border-t border-slate-100 pt-5">
            <button
              type="submit"
              disabled={
                submitting ||
                file === null ||
                criteria.trim() === "" ||
                (provider === "openrouter"
                  ? openrouterApiKey.trim() === "" || openrouterModel.trim() === ""
                  : ollamaModel.trim() === "")
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {submitting ? (
                <>
                  <SpinnerIcon className="h-4 w-4" />
                  <ElapsedTimer startedAt={phase.startedAt} />
                </>
              ) : (
                "Review resume"
              )}
            </button>

            <p className="mt-2 text-center text-xs text-slate-400">
              The AI runs a verification pass and may retry up to 3 times — this can take a few minutes.
            </p>
            <p className="mt-1 text-center text-xs text-slate-400">
              Your resume is sent only to the AI provider you configured. Nothing is stored by APAR.
            </p>
          </div>
        </form>

        <div ref={outcomeRef} tabIndex={-1} className="mt-8 space-y-8 outline-none focus-visible:outline-none">
          {phase.kind === "error" && <ErrorBanner message={phase.message} />}
          {phase.kind === "result" && <ResultsCard data={phase.data} />}
        </div>
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-center text-xs text-slate-300">
        APAR · Stage 1 · advisory assessments only
      </footer>
    </div>
  );
}
