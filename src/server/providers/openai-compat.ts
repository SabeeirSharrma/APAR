import { DEFAULT_OLLAMA_ENDPOINT, type ResolvedProviderConfig } from "../../shared/types";
import { PipelineError } from "../errors";

/**
 * Single OpenAI-compatible chat-completions client shared by both providers:
 * - OpenRouter: https://openrouter.ai/api/v1 (Bearer key)
 * - Ollama:     <endpoint>/v1 (no auth)
 * Plain fetch on purpose — no SDK, works uniformly across both.
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatOptions {
  timeoutMs: number;
  temperature?: number;
}

function baseUrlFor(cfg: ResolvedProviderConfig): string {
  if (cfg.provider === "openrouter") return OPENROUTER_BASE_URL;
  const endpoint = (cfg.ollamaEndpoint ?? DEFAULT_OLLAMA_ENDPOINT).replace(/\/+$/, "");
  return `${endpoint}/v1`;
}

async function toPipelineError(err: unknown, cfg: ResolvedProviderConfig): Promise<PipelineError> {
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return new PipelineError("PROVIDER_TIMEOUT", `${cfg.provider} did not respond in time.`);
  }
  console.error(`[provider] ${cfg.provider} request failed:`, err);
  return new PipelineError("PROVIDER_ERROR", `Could not reach ${cfg.provider}. Check your configuration and that the service is online.`);
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

/** Calls the provider; returns the assistant message content string. */
export async function chatCompletion(
  cfg: ResolvedProviderConfig,
  model: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  const url = `${baseUrlFor(cfg)}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.provider === "openrouter" && cfg.openrouterApiKey) {
    headers["Authorization"] = `Bearer ${cfg.openrouterApiKey}`;
    headers["HTTP-Referer"] = "https://apar.local";
    headers["X-Title"] = "APAR";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        // Best-effort JSON mode; some models reject it, handled below.
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    throw await toPipelineError(err, cfg);
  }

  if (!res.ok) {
    const upstreamBody = (await res.text()).slice(0, 300);
    console.error(`[provider] HTTP ${res.status} from ${url}: ${upstreamBody}`);
    throw new PipelineError(
      "PROVIDER_ERROR",
      `${cfg.provider} returned an error (HTTP ${res.status}) for model "${model}".`,
    );
  }

  let payload: ChatCompletionResponse;
  try {
    payload = (await res.json()) as ChatCompletionResponse;
  } catch {
    throw new PipelineError("PROVIDER_ERROR", `${cfg.provider} returned a malformed response body.`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new PipelineError("PROVIDER_ERROR", `${cfg.provider} returned no message content for model "${model}".`);
  }
  return content;
}
