import { createAiError, type AiError, type AiRequest } from "@pravnix/ai-core";

export function validateRequest(request: AiRequest): AiError | undefined {
  if (!request.messages || request.messages.length === 0) {
    return createAiError("InvalidConfiguration", "AiRequest.messages must be non-empty.");
  }
  return undefined;
}
