export interface WithRetryOptions {
  maxRetries: number;
  isRetryable: (error: unknown) => boolean;
  /** Base delay in ms; actual delay is `backoffMs * 2^attempt`. */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Bounded exponential-backoff retry for a single provider call. Purpose-built instead of pulling
 * in a Polly-equivalent dependency — there isn't one idiomatic npm package for this that the rest
 * of the ecosystem already trusts. Mirrors the .NET platform's per-provider Polly policy: this is
 * the ONLY retry layer at the transport level. The orchestrator's structured-output repair loop is
 * a separate, independently-bounded mechanism — never stack both on the same failure.
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, options: WithRetryOptions): Promise<T> {
  const { maxRetries, isRetryable, backoffMs = 250, sleep = defaultSleep } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }
      await sleep(backoffMs * 2 ** attempt);
    }
  }

  throw lastError;
}
