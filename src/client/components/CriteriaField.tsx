interface CriteriaFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  error?: string | undefined;
}

const MAX_LENGTH = 20_000;

export function CriteriaField({ value, disabled, onChange, error }: CriteriaFieldProps) {
  const errorId = error !== undefined ? "criteria-error" : undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor="criteria" className="block text-sm font-medium text-slate-700">
          Hiring criteria
        </label>
        <span className="text-xs tabular-nums text-slate-400">
          {value.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}
        </span>
      </div>
      <textarea
        id="criteria"
        rows={6}
        maxLength={MAX_LENGTH}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={errorId}
        placeholder={"One criterion per line, e.g.\n5+ years of backend experience with Go or Java\nExperience operating services in production\nComfort working directly with product stakeholders"}
        className={`mt-1 block w-full rounded-xl border bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
          error !== undefined
            ? "border-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
        }`}
      />
      {error !== undefined && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
