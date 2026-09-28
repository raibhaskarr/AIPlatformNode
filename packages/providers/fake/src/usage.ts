import type { AiRequest, AiUsage } from "@pravnix/ai-core";

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateUsage(request: AiRequest, responseText: string): AiUsage {
  const inputText = request.messages
    .flatMap((m) => m.content)
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ");
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(responseText);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}
