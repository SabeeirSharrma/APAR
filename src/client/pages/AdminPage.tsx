import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FormEvent } from "react";
import {
  CRITERIA_MAX,
  POSITION_NAME_MAX,
  type Position,
  type PositionInput,
  type Provider,
  type User,
} from "../../shared/types";
import {
  adminCreatePosition,
  adminDeletePosition,
  adminListPositions,
  adminUpdatePosition,
  listRoster,
  ApiTransportError,
  PositionInputSchema,
} from "../api";
import { CriteriaField } from "../components/CriteriaField";
import { ErrorBanner } from "../components/Banners";
import { ProviderSection } from "../components/ProviderSection";
import { ApplicationsPanel } from "../components/admin/ApplicationsPanel";
import { RosterPanel } from "../components/admin/RosterPanel";
import { SpinnerIcon } from "../components/icons";

type Tab = "positions" | "roster" | "applications";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "positions", label: "Positions" },
  { id: "roster", label: "Interviewer roster" },
  { id: "applications", label: "Applications" },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("positions");
  const [interviewers, setInterviewers] = useState<User[]>([]);

  const refreshRoster = useCallback(async () => {
    try {
      setInterviewers(await listRoster("interviewer"));
    } catch {
      /* panels surface their own errors */
    }
  }, []);

  useEffect(() => {
    void refreshRoster();
  }, [refreshRoster]);

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Admin</h2>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
              tab === t.id ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "positions" && <PositionsPanel interviewers={interviewers} />}
      {tab === "roster" && <RosterPanel interviewers={interviewers} onChanged={refreshRoster} />}
      {tab === "applications" && <ApplicationsPanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Positions panel
// ---------------------------------------------------------------------------

function PositionsPanel({ interviewers }: { interviewers: User[] }) {
  const [list, setList] = useState<
    { kind: "loading" } | { kind: "ready"; items: Position[] } | { kind: "failed"; message: string }
  >({ kind: "loading" });
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
        setPageError(err instanceof Error ? err.message : "Delete failed.");
        setDeletingId(null);
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-slate-400">
          Define openings and the AI configuration used to review their applications. The pool decides who new
          applications are assigned to.
        </p>
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
          interviewers={interviewers}
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
              interviewers={interviewers}
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
          {list.items.map((p) => {
            const poolNames = p.interviewerIds
              .map((id) => interviewers.find((u) => u.id === id)?.name ?? "")
              .filter((n) => n !== "");
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{p.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{positionSummaryLine(p)}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Pool:{" "}
                      {poolNames.length > 0 ? (
                        poolNames.join(", ")
                      ) : (
                        <span className="font-medium text-amber-600">empty — applications will queue as stuck</span>
                      )}
                    </p>
                    <p className="mt-1 line-clamp-2 max-w-prose text-xs text-slate-400">{p.criteria}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(p.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    {deletingId === p.id ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          autoFocus
                          onClick={() => void handleDelete(p.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingId(p.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function positionSummaryLine(p: Position): string {
  const model =
    p.provider === "openrouter" ? (p.openrouterModel ?? "no model set") : (p.ollamaModel ?? "no model set");
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

// ---------------------------------------------------------------------------
// Create/edit form
// ---------------------------------------------------------------------------

interface PositionFormProps {
  initial?: Position;
  interviewers: User[];
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}

interface FormFields {
  name: string;
  criteria: string;
  provider: Provider;
  openrouterApiKey: string;
  openrouterModel: string;
  ollamaEndpoint: string;
  ollamaModel: string;
  verifierModelOverride: string;
  interviewerIds: string[];
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
  interviewerIds: [],
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
    interviewerIds: [...p.interviewerIds],
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
    interviewerIds: f.interviewerIds,
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

function PositionForm({ initial, interviewers, onSaved, onCancel }: PositionFormProps) {
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

  const togglePoolMember = useCallback((id: string, checked: boolean) => {
    setFields((prev) => ({
      ...prev,
      interviewerIds: checked ? [...prev.interviewerIds, id] : prev.interviewerIds.filter((x) => x !== id),
    }));
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
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
      setFormError(err instanceof ApiTransportError || err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = (hasError: boolean): string =>
    `mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
      hasError
        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
        : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
    }`;

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="space-y-6 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm sm:p-8"
    >
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

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">Interviewer pool</legend>
        <p className="mt-1 text-xs text-slate-400">
          New applications are auto-assigned to the least-loaded active member. An empty pool queues applications as
          stuck.
        </p>
        {interviewers.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            No interviewers exist yet — add them under the “Interviewer roster” tab first.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {interviewers.map((u) => {
              const checked = fields.interviewerIds.includes(u.id);
              return (
                <li key={u.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      checked
                        ? "border-indigo-400 bg-indigo-50/60 text-indigo-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={saving || !u.active}
                      onChange={(e) => togglePoolMember(u.id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">
                      {u.name}
                      {!u.active && <span className="ml-1 text-xs text-slate-400">(inactive)</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || fields.name.trim() === "" || fields.criteria.trim() === ""}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {saving && <SpinnerIcon className="h-4 w-4" />}
          {initial ? "Save changes" : "Create position"}
        </button>
      </div>

      <p className="text-xs text-slate-300">
        Stage 3 note: this area is now login-protected. Applicants use the{" "}
        <Link to="/" className="underline underline-offset-2 hover:text-slate-500">
          public application form
        </Link>
        .
      </p>
    </form>
  );
}
