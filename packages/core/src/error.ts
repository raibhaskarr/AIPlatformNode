export type AiErrorCode =
  | "InvalidConfiguration"
  | "UnsupportedProvider"
  | "AuthenticationFailure"
  | "RateLimited"
  | "Timeout"
  | "ProviderUnavailable"
  | "Cancelled"
  | "InvalidResponse"
  | "StructuredOutputParseFailure"
  | "StructuredOutputValidationFailure"
  | "RepairFailure"
  | "ContentPolicyRejection"
  | "Unknown";

/**
 * `safeMessage` must never echo a raw provider response body, header, or secret — hand-write it
 * per failure case. See docs/security-and-privacy.md.
 */
export interface AiError {
  code: AiErrorCode;
  safeMessage: string;
  retryable: boolean;
}

export function createAiError(code: AiErrorCode, safeMessage: string, retryable = false): AiError {
  return { code, safeMessage, retryable };
}

/**
 * Throwable wrapper providers use when they've already normalized a failure to an `AiError`
 * (e.g. via `mapHttpStatusToAiError`). The orchestrator recognizes this and passes the AiError
 * through unchanged instead of re-wrapping it as `Unknown`.
 */
export class AiProviderError extends Error implements AiError {
  readonly code: AiErrorCode;
  readonly safeMessage: string;
  readonly retryable: boolean;

  constructor(error: AiError) {
    super(error.safeMessage);
    this.name = "AiProviderError";
    this.code = error.code;
    this.safeMessage = error.safeMessage;
    this.retryable = error.retryable;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
