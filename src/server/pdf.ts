import { extractText } from "unpdf";
import { MIN_RESUME_TEXT_LENGTH } from "../shared/types";
import { PipelineError } from "./errors";

/**
 * Extracts plain text from a PDF's raw bytes.
 * Text extraction (not raw base64 passthrough) is deliberate: Ollama models
 * cannot ingest PDFs, so uniform extracted text is the only approach that
 * works identically across OpenRouter and local models.
 */
export async function extractResumeText(data: Uint8Array): Promise<string> {
  let text: string;
  try {
    const result = await extractText(data, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text;
  } catch {
    throw new PipelineError(
      "UNREADABLE_PDF",
      "Could not read the uploaded file as a PDF. Make sure it is a valid, non-corrupted PDF document.",
    );
  }

  const trimmed = text.trim();
  if (trimmed.length < MIN_RESUME_TEXT_LENGTH) {
    throw new PipelineError(
      "UNREADABLE_PDF",
      `Only ${trimmed.length} characters of text could be extracted from this PDF. It may be a scanned image or contain no readable text.`,
    );
  }
  return trimmed;
}
