import OpenAI from 'openai';

// ============================================================================
// Model Provider Client (§9.3)
// ============================================================================

export type ModelProviderType = 'openrouter' | 'openai-compatible';

export interface ModelConfig {
  provider: ModelProviderType;
  endpointUrl?: string;
  apiKey?: string;
  modelName: string;
}

/**
 * Create an OpenAI-compatible client for either OpenRouter or a local model.
 * Both use the OpenAI-compatible API surface (§9.3).
 */
export function createModelClient(config: ModelConfig): OpenAI {
  const baseURL = config.provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : config.endpointUrl || 'http://localhost:11434/v1';

  const apiKey = config.provider === 'openrouter'
    ? (config.apiKey || process.env.OPENROUTER_API_KEY || '')
    : (config.apiKey || 'ollama'); // Ollama doesn't require a real key

  return new OpenAI({
    baseURL,
    apiKey,
  });
}

/**
 * Main model prompt template (§8).
 * This is the fixed system instructions + criteria injection slot.
 */
export function buildMainPrompt(companyName: string, criteria: string): string {
  return `You are an interviewer-support assistant for ${companyName}. Your task is to analyze
the attached resume and assess the candidate strictly against the criteria below.
Your output is advisory only — a human interviewer makes the final decision.

Position Criteria:
${criteria}

For EACH criterion listed above, provide:
- A score from 0-100 reflecting how well the resume demonstrates that criterion.
- A one-line justification for that score, grounded in specific resume content.

Then provide:
- An overall verdict: "Meets Criteria" / "Partially Meets Criteria" / "Does Not Meet Criteria".
- A concise summary of relevant experience, education, and skills.
- A clear closing recommendation for the interviewer.

Respond ONLY in the following JSON structure, no preamble or additional text:
{
  "criteria_scores": [
    { "criterion": "...", "score": 0-100, "justification": "..." }
  ],
  "overall_verdict": "Meets Criteria" | "Partially Meets Criteria" | "Does Not Meet Criteria",
  "summary": "...",
  "recommendation": "..."
}`;
}

/**
 * Verification model prompt (§4 step 6).
 * Checks the main model's output for internal consistency against criteria.
 */
export function buildVerificationPrompt(criteria: string): string {
  return `You are a verification assistant. Your job is to check whether the following analysis output is internally consistent with the stated criteria.

Position Criteria:
${criteria}

You will receive the main model's JSON output. Check for:
1. High scores (80+) with reasoning that describes gaps or disqualifying factors
2. Low scores (30-) with reasoning that describes strong qualifications
3. Overall verdict that contradicts the pattern of individual criterion scores
4. Missing or empty justifications
5. Scores that don't match the justification text

Respond ONLY in the following JSON structure:
{
  "passed": true | false,
  "issues": ["issue 1", "issue 2"] // empty array if passed
}`;
}

/**
 * Main model response shape (§5, §8).
 */
export interface MainModelResponse {
  criteria_scores: Array<{
    criterion: string;
    score: number;
    justification: string;
  }>;
  overall_verdict: 'Meets Criteria' | 'Partially Meets Criteria' | 'Does Not Meet Criteria';
  summary: string;
  recommendation: string;
}

/**
 * Verification model response shape (§4 step 6).
 */
export interface VerificationResponse {
  passed: boolean;
  issues: string[];
}

/**
 * Build request params for a model call.
 * Conditionally includes response_format (only supported by OpenRouter/OpenAI, not Ollama).
 */
function buildCompletionParams(
  config: ModelConfig,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  temperature: number,
): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
  const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: config.modelName,
    messages,
    temperature,
  };

  // response_format is only supported by OpenRouter and OpenAI — not Ollama
  if (config.provider === 'openrouter') {
    params.response_format = { type: 'json_object' };
  }

  return params;
}

/**
 * Call the main model to analyze a resume (§4 step 5).
 * Returns structured JSON per the prompt contract (§8).
 */
export async function callMainModel(
  client: OpenAI,
  config: ModelConfig,
  systemPrompt: string,
  resumeBase64: string,
): Promise<MainModelResponse> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Please analyze this resume against the criteria provided in the system instructions.',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:application/pdf;base64,${resumeBase64}`,
          },
        },
      ],
    },
  ];

  const response = await client.chat.completions.create(
    buildCompletionParams(config, messages, 0.3),
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from main model');
  }

  return JSON.parse(content) as MainModelResponse;
}

/**
 * Call the verification model to check main model output (§4 step 6).
 * Returns whether the output passed consistency checks.
 */
export async function callVerificationModel(
  client: OpenAI,
  config: ModelConfig,
  criteria: string,
  mainModelOutput: MainModelResponse,
): Promise<VerificationResponse> {
  const systemPrompt = buildVerificationPrompt(criteria);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: JSON.stringify(mainModelOutput),
    },
  ];

  const response = await client.chat.completions.create(
    buildCompletionParams(config, messages, 0.1),
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from verification model');
  }

  return JSON.parse(content) as VerificationResponse;
}

/**
 * Derive a color grade from a numeric score (§5, §8).
 * Uses flat, solid color bands — not gradient.
 * Thresholds locked: A: 80-100, B: 70-80, C: 60-70, D: 55-60, F: <55
 */
export type ColorGrade = 'excellent' | 'good' | 'average' | 'below-average' | 'poor';

export function scoreToGrade(score: number): ColorGrade {
  if (score >= 80) return 'excellent';   // A
  if (score >= 70) return 'good';        // B
  if (score >= 60) return 'average';     // C
  if (score >= 55) return 'below-average'; // D
  return 'poor';                          // F
}

/**
 * Calculate overall grade from per-criterion scores (§5).
 */
export function calculateOverallGrade(scores: Array<{ score: number }>): ColorGrade {
  if (scores.length === 0) return 'average';
  const average = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  return scoreToGrade(average);
}
