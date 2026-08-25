import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "../../../shared/types";
import {
  createInterviewer,
  deleteInterviewer,
  updateInterviewer,
  type RosterFormInput,
} from "../../api";
import { ErrorBanner } from "../Banners";
import { SpinnerIcon } from "../icons";

interface RosterPanelProps {
  interviewers: User[];
  onChanged: () => Promise<void>;
}

interface FormFields {
  name: string;
  email: string;
  active: boolean;
  password: string;
}

function fieldsFor(u: User | null): FormFields {
  return u === null
    ? { name: "", email: "", active: true, password: "" }
    : { name: u.name, email: u.email, active: u.active, password: "" };
}

export function RosterPanel({ interviewers, onChanged }: RosterPanelProps) {
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [fields, setFields] = useState<FormFields>(fieldsFor(null));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "email" | "password", string>>>({});
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | undefined>(undefined);

  const startEdit = useCallback((u: User | null) => {
    setFieldErrors({});
    setFormError(undefined);
    setDeletingId(null);
    setFields(fieldsFor(u));
    setEditing(u === null ? "new" : u.id);
  }, []);

  const handleSave = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (saving || editing === null) return;

    const errors: typeof fieldErrors = {};
    if (fields.name.trim() === "") errors.name = "Name is required.";
    if (!/^\S+@\S+\.\S+$/.test(fields.email.trim())) errors.email = "A valid email is required.";
    if (editing === "new" && fields.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (fields.password !== "" && fields.password.length < 8) {
      errors.password = "New password must be at least 8 characters.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: RosterFormInput = {
      name: fields.name.trim(),
      email: fields.email.trim().toLowerCase(),
      active: fields.active,
      password: fields.password,
    };

    setSaving(true);
    setFormError(undefined);
    try {
      if (editing === "new") await createInterviewer(payload);
      else await updateInterviewer(editing, payload);
      setEditing(null);
      await onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (id: string) => {
      setPageError(undefined);
      try {
        await deleteInterviewer(id);
        setDeletingId(null);
        await onChanged();
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Delete failed.");
        setDeletingId(null);
      }
    },
    [onChanged],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Interviewer accounts sign in to review their assigned applications. Deactivated members stop receiving new
          assignments but keep existing ones.
        </p>
        {editing === null && (
          <button
            type="button"
            onClick={() => startEdit(null)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add interviewer
          </button>
        )}
      </div>

      {pageError !== undefined && <ErrorBanner message={pageError} />}

      {editing !== null && (
        <form onSubmit={(e) => void handleSave(e)} noValidate className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight text-slate-800">
            {editing === "new" ? "Add interviewer" : "Edit interviewer"}
          </h3>
          {formError !== undefined && <ErrorBanner message={formError} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="r-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="r-name"
                type="text"
                value={fields.name}
                onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
                aria-invalid={fieldErrors.name !== undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                  fieldErrors.name !== undefined
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.name !== undefined && (
                <p role="alert" className="mt-1.5 text-sm text-red-600">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="r-email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="r-email"
                type="email"
                autoComplete="off"
                value={fields.email}
                onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
                aria-invalid={fieldErrors.email !== undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                  fieldErrors.email !== undefined
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.email !== undefined && (
                <p role="alert" className="mt-1.5 text-sm text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="r-password" className="block text-sm font-medium text-slate-700">
                Password{" "}
                {editing !== "new" && <span className="font-normal text-slate-400">(leave blank to keep current)</span>}
              </label>
              <input
                id="r-password"
                type="password"
                autoComplete="new-password"
                value={fields.password}
                onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
                aria-invalid={fieldErrors.password !== undefined}
                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                  fieldErrors.password !== undefined
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
                }`}
              />
              {fieldErrors.password !== undefined && (
                <p role="alert" className="mt-1.5 text-sm text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={fields.active}
                onChange={(e) => setFields((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Active (receives assignments)
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setEditing(null)}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-500"
            >
              {saving && <SpinnerIcon className="h-4 w-4" />}
              Save
            </button>
          </div>
        </form>
      )}

      {interviewers.length === 0 && editing === null && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-600">No interviewers yet.</p>
          <p className="mt-1 text-sm text-slate-400">Add interviewers, then include them in a position's pool.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {interviewers.map((u) => (
          <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {u.name}{" "}
                  {!u.active && (
                    <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                      inactive
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(u)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Edit
                </button>
                {deletingId === u.id ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      autoFocus
                      onClick={() => void handleDelete(u.id)}
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
                    onClick={() => setDeletingId(u.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
