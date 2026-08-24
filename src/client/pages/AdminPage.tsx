import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CRITERIA_MAX,
  POSITION_NAME_MAX,
  type Position,
  type PositionInput,
  type Provider,
} from "../../shared/types";
import {
  adminCreatePosition,
  adminDeletePosition,
  adminListPositions,
  adminUpdatePosition,
  ApiTransportError,
  PositionInputSchema,
} from "../api";
import { CriteriaField } from "../components/CriteriaField";
import { ErrorBanner } from "../components/Banners";
import { ProviderSection } from "../components/ProviderSection";
import { SpinnerIcon } from "../components/icons";
import { formatBytes } from "../lib/format";

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; items: Position[] }
  | { kind: "failed"; message: string };

interface FormFields {
  name: string;
  criteria: string;
  provider: Provider;
  openrouterApiKey: string;
  openrouterModel: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  verifierModelOverride: string;
}

const EMPTY_FORM: FormFields = {
  name: "",
  criteria: "",
  provider: "openrouter",
  openrouterApiKey: "",
  openrouterModel: "",
  ollamaEndpoint: "",
  ollamaModel: "",
  verifierModelOverride: "",
};

function formFromPosition(p: Position): FormFields {
  return {
    name: p.name,
    criteria: p.criteria,
    provider: p.provider,
    openrouterApiKey: p.openrouterApiKey ?? "",
    openrouterModel: p.openrouterModel ?? "",
    ollamaEndpoint: p.ollamaEndpoint ?? "",
    ollamaModel: p.ollamaModel ?? "",
    verifierModelOverride: p.verifierModelOverride ?? "",
  };
}

function buildInput(f: FormFields): unknown {
  return {
    name: f.name.trim(),
    criteria: f.criteria.trim(),
    provider: f.provider,
    ...(f.provider === "openrouter"
      ? { openrouterApiKey: f.openrouterApiKey.trim(), openrouterModel: f.openrouterModel.trim() }
      : {
          ...(f.ollamaEndpoint.trim() !== "" ? { ollamaEndpoint: f.ollamaEndpoint.trim() } : {}),
          ollamaModel: f.ollamaModel.trim(),
        }),
    ...(f.verifierModelOverride.trim() !== "" ? { verifierModelOverride: f.verifierModelOverride.trim() } : {}),
  };
}

type FieldKey = "name" | "criteria" | "apiKey" | "model" | "endpoint";

function fieldKeyForPath(path: PropertyKey[]): FieldKey {
  const first = path[0];
  if (first === "openrouterApiKey") return "apiKey";
  if (first === "openrouterModel" || first === "ollamaModel") return "model";
  if (first === "ollamaEndpoint") return "endpoint";
  if (first === "criteria") return "criteria";
  return "name";
}

function positionSummaryLine(p: Position): string {
  const model =
    p.provider === "openrouter"
      ? (p.openrouterModel ?? "no model set")
      : (p.ollamaModel ?? "no model set");
  const keyHint =
    p.provider === "openrouter"
      ? p.openrouterApiKey
        ? ` · key ••••${p.openrouterApiKey.slice(-4)}`
        : " · no API key"
      : "";
  const verifier =
    p.verifierModelOverride !== undefined ? ` · verifier ${p.verifierModelOverride}` : "";
  return `${p.provider === "openrouter" ? "OpenRouter" : "Ollama"} · ${model}${keyHint}${verifier}`;
}

export default function AdminPage() {
  const [list, setList] = useState<ListState>({ kind: "loading" });
  /** null = list view; "new" = creating; a position id = editing that row. */
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const items = await adminListPositions();
      setList({ kind: "ready", items });
    } catch (err) {
      setList({
        kind: "failed",
        message: err instanceof Error ? err.message : "Could not load positions.",
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      setPageError(undefined);
      try {
        await adminDeletePosition(id);
        setDeletingId(null);
        await refresh();
      } catch (err) {
        setPageError(err instanceof ApiTransportError || err instanceof Error ? err.message : "Delete failed.");
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Positions</h2>
          <p className="text-sm text-slate-400">
            Define openings and the AI configuration used to review their applications.
          </p>
        </div>
        {list.kind === "ready" && editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            New position
          </button>
        )}
      </div>

      {pageError !== undefined && <ErrorBanner message={pageError} />}

      {editing === "new" && (
        <PositionForm
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
      {typeof editing === "string" &&
        editing !== "new" &&
        list.kind === "ready" &&
        (() => {
          const target = list.items.find((p) => p.id === editing);
          if (!target) return null;
          return (
            <PositionForm
              initial={target}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await refresh();
              }}
            />
          );
        })()}

      {list.kind === "loading" && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <SpinnerIcon className="h-4 w-4" /> Loading positions…
        </p>
      )}

      {list.kind === "failed" && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {list.message}
        </div>
      )}

      {list.kind === "ready" && list.items.length === 0 && editing === null && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-600">No positions yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Create your first position to start accepting applications.
          </p>
        </div>
      )}

      {list.kind === "ready" && list.items.length > 0 && editing === null && (
        <ul className="space-y-3">
          {list.items.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{positionSummaryLine(p)}</p>
                  <p className="mt-1 line-clamp-2 max-w-prose text-xs text-slate-400">{p.criteria}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(p.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Edit
                  </button>
                  {deletingId === p.id ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => void handleDelete(p.id)}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(p.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-300">
                Updated{" "}
                {new Date(p.updatedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-300">
        Stage 2 note: this page is unprotected by design — authentication arrives in stage 3. Anyone with access to
        this instance can read stored provider keys. See the{" "}
        <Link to="/" className="underline underline-offset-2 hover:text-slate-500">
          applicant page
        </Link>{" "}
        for what candidates see ({formatBytes(10 * 1024 * 1024)} PDF limit applies).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create/edit form
// ---------------------------------------------------------------------------

interface PositionFormProps {
  initial?: Position;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

function PositionForm({ initial, onSaved, onCancel }: PositionFormProps) {
  const [fields, setFields] = useState<FormFields>(initial ? formFromPosition(initial) : EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(<K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearFieldError = useCallback((key: FieldKey) => {
    setFieldErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (saving) return;

    const parsed = PositionInputSchema.safeParse(buildInput(fields));
    if (!parsed.success) {
      const errors: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = fieldKeyForPath(issue.path);
        if (errors[key] === undefined) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setFormError(undefined);
    try {
      const input = parsed.data as PositionInput;
      if (initial) await adminUpdatePosition(initial.id, input);
      else await adminCreatePosition(input);
      await onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = (hasError: boolean): string =>
    `mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
      hasError ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
    }`;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-base font-semibold tracking-tight text-slate-800">
        {initial ? "Edit position" : "New position"}
      </h3>

      {formError !== undefined && <ErrorBanner message={formError} />}

      <div>
        <label htmlFor="pos-name" className="block text-sm font-medium text-slate-700">
          Position name
        </label>
        <input
          id="pos-name"
          type="text"
          maxLength={POSITION_NAME_MAX}
          disabled={saving}
          value={fields.name}
          onChange={(e) => {
            setField("name", e.target.value);
            clearFieldError("name");
          }}
          aria-invalid={fieldErrors.name !== undefined}
          placeholder="Senior Backend Engineer"
          className={inputClasses(fieldErrors.name !== undefined)}
        />
        {fieldErrors.name !== undefined && (
          <p role="alert" className="mt-1.5 text-sm text-red-600">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <CriteriaField
        value={fields.criteria}
        disabled={saving}
        onChange={(v) => {
          setField("criteria", v);
          clearFieldError("criteria");
        }}
        error={fieldErrors.criteria}
      />

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">AI provider for this position</legend>
        <div className="mt-3">
          <ProviderSection
            provider={fields.provider}
            onProviderChange={(p) => setField("provider", p)}
            openrouterApiKey={fields.openrouterApiKey}
            onOpenrouterApiKeyChange={(v) => {
              setField("openrouterApiKey", v);
              clearFieldError("apiKey");
            }}
            openrouterModel={fields.openrouterModel}
            onOpenrouterModelChange={(v) => {
              setField("openrouterModel", v);
              clearFieldError("model");
            }}
            ollamaEndpoint={fields.ollamaEndpoint}
            onOllamaEndpointChange={(v) => {
              setField("ollamaEndpoint", v);
              clearFieldError("endpoint");
            }}
            ollamaModel={fields.ollamaModel}
            onOllamaModelChange={(v) => {
              setField("ollamaModel", v);
              clearFieldError("model");
            }}
            verifierOverride={fields.verifierModelOverride}
            onVerifierOverrideChange={(v) => setField("verifierModelOverride", v)}
            apiKeyError={fieldErrors.apiKey}
            modelError={fieldErrors.model}
            disabled={saving}
          />
          {fieldErrors.endpoint !== undefined && (
            <p role="alert" className="mt-1.5 text-sm text-red-600">
              {fieldErrors.endpoint}
            </p>
          )}
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || fields.name.trim() === "" || fields.criteria.trim() === ""}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {saving && <SpinnerIcon className="h-4 w-4" />}
          {initial ? "Save changes" : "Create position"}
        </button>
      </div>
    </form>
  );
}
