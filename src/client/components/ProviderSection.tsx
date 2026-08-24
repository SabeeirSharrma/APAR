import { useState } from "react";
import type { KeyboardEvent } from "react";
import { DEFAULT_OLLAMA_ENDPOINT, type Provider } from "../../shared/types";
import { EyeIcon, EyeSlashIcon } from "./icons";

interface ProviderSectionProps {
  provider: Provider;
  onProviderChange: (p: Provider) => void;
  openrouterApiKey: string;
  onOpenrouterApiKeyChange: (v: string) => void;
  openrouterModel: string;
  onOpenrouterModelChange: (v: string) => void;
  ollamaEndpoint: string;
  onOllamaEndpointChange: (v: string) => void;
  ollamaModel: string;
  onOllamaModelChange: (v: string) => void;
  verifierOverride: string;
  onVerifierOverrideChange: (v: string) => void;
  apiKeyError?: string | undefined;
  modelError?: string | undefined;
  disabled: boolean;
}

const PROVIDER_OPTIONS: Array<{ value: Provider; label: string; hint: string }> = [
  { value: "openrouter", label: "OpenRouter", hint: "Cloud models, BYO API key" },
  { value: "ollama", label: "Local Ollama", hint: "Runs on your machine" },
];

function inputClasses(hasError: boolean): string {
  return `mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 ${
    hasError ? "border-red-300 focus:border-red-500 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-200"
  }`;
}

export function ProviderSection(props: ProviderSectionProps) {
  const {
    provider,
    onProviderChange,
    apiKeyError,
    modelError,
    disabled,
  } = props;

  const handleRadioKeys = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onProviderChange(provider === "openrouter" ? "ollama" : "openrouter");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onProviderChange(provider === "openrouter" ? "ollama" : "openrouter");
    }
  };

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-slate-700">AI provider</legend>

      <div role="radiogroup" aria-label="AI provider" onKeyDown={handleRadioKeys} className="grid grid-cols-2 gap-2 sm:max-w-md">
        {PROVIDER_OPTIONS.map((opt) => {
          const selected = provider === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onProviderChange(opt.value)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                selected
                  ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600"
                  : "border-slate-200 bg-white hover:border-indigo-300"
              }`}
            >
              <span className={`block text-sm font-semibold ${selected ? "text-indigo-700" : "text-slate-700"}`}>
                {opt.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">{opt.hint}</span>
            </button>
          );
        })}
      </div>

      {provider === "openrouter" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="or-key" className="block text-sm font-medium text-slate-700">
              API key
            </label>
            <ApiKeyInput
              id="or-key"
              value={props.openrouterApiKey}
              disabled={disabled}
              hasError={apiKeyError !== undefined}
              onChange={props.onOpenrouterApiKeyChange}
            />
            {apiKeyError !== undefined && (
              <p role="alert" className="mt-1.5 text-sm text-red-600">
                {apiKeyError}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="or-model" className="block text-sm font-medium text-slate-700">
              Model
            </label>
            <input
              id="or-model"
              type="text"
              autoComplete="off"
              disabled={disabled}
              value={props.openrouterModel}
              onChange={(e) => props.onOpenrouterModelChange(e.target.value)}
              aria-invalid={modelError !== undefined}
              placeholder="openai/gpt-4o-mini"
              className={inputClasses(modelError !== undefined)}
            />
            {modelError !== undefined && (
              <p role="alert" className="mt-1.5 text-sm text-red-600">
                {modelError}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ollama-endpoint" className="block text-sm font-medium text-slate-700">
              Endpoint <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="ollama-endpoint"
              type="url"
              autoComplete="off"
              disabled={disabled}
              value={props.ollamaEndpoint}
              onChange={(e) => props.onOllamaEndpointChange(e.target.value)}
              placeholder={DEFAULT_OLLAMA_ENDPOINT}
              className={inputClasses(false)}
            />
            <p className="mt-1.5 text-xs text-slate-400">Defaults to {DEFAULT_OLLAMA_ENDPOINT} when empty.</p>
          </div>
          <div>
            <label htmlFor="ollama-model" className="block text-sm font-medium text-slate-700">
              Model
            </label>
            <input
              id="ollama-model"
              type="text"
              autoComplete="off"
              disabled={disabled}
              value={props.ollamaModel}
              onChange={(e) => props.onOllamaModelChange(e.target.value)}
              aria-invalid={modelError !== undefined}
              placeholder="llama3.1"
              className={inputClasses(modelError !== undefined)}
            />
            {modelError !== undefined && (
              <p role="alert" className="mt-1.5 text-sm text-red-600">
                {modelError}
              </p>
            )}
          </div>
        </div>
      )}

      <details className="group rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <summary className="cursor-pointer select-none text-sm font-medium text-slate-600 marker:content-none transition-colors hover:text-slate-800">
          Advanced
        </summary>
        <div className="mt-3 max-w-md">
          <label htmlFor="verifier-model" className="block text-sm font-medium text-slate-700">
            Verification model override <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="verifier-model"
            type="text"
            autoComplete="off"
            disabled={disabled}
            value={props.verifierOverride}
            onChange={(e) => props.onVerifierOverrideChange(e.target.value)}
            placeholder="Defaults to the main model"
            className={inputClasses(false)}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            A second, smaller model used to double-check the assessment for internal consistency.
          </p>
        </div>
      </details>
    </fieldset>
  );
}

function ApiKeyInput({
  id,
  value,
  disabled,
  hasError,
  onChange,
}: {
  id: string;
  value: string;
  disabled: boolean;
  hasError: boolean;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasError}
        placeholder="sk-or-..."
        className={`${inputClasses(hasError)} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide API key" : "Show API key"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        {visible ? <EyeSlashIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
