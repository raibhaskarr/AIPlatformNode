import { createAiError, type AiError } from "@pravnix/ai-core";

/**
 * Shared HTTP status → AiErrorCode mapping used by every real provider, so Anthropic/Gemini/OpenAI
 * normalize failures identically. `safeMessage` never echoes the raw response body.
 */
export function mapHttpStatusToAiError(status: number, providerName: string): AiError {
  if (status === 401 || status === 403) {
    return createAiError("AuthenticationFailure", `${providerName} rejected the request's credentials.`, false);
  }
  if (status === 429) {
    return createAiError("RateLimited", `${providerName} rate-limited this request.`, true);
  }
  if (status >= 500 && status < 600) {
    return createAiError("ProviderUnavailable", `${providerName} is temporarily unavailable.`, true);
  }
  if (status === 408) {
    return createAiError("Timeout", `${providerName} timed out.`, true);
  }
  return createAiError("Unknown", `${providerName} returned an unexpected error (status ${status}).`, false);
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}
