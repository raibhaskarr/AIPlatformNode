/**
 * Diverges deliberately from the .NET platform's text-only `AiContentPart`: PranTrackingSystem
 * already has proven callers for image (IEP/term-report OCR), audio (transcription), and video
 * (session analysis) input, so multimodal support is built in from the start. See
 * docs/adr/0002-ts-port-divergences.md.
 */
export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: AiBinaryContent; mimeType: string }
  | { type: "audio"; data: AiBinaryContent; mimeType: string }
  | { type: "video"; data: AiBinaryContent; mimeType: string };

/** Either an inline base64-encoded payload, or a provider-fetchable URI. */
export type AiBinaryContent = { base64: string } | { uri: string };

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: AiContentPart[];
}

export function textMessage(role: AiRole, text: string): AiMessage {
  return { role, content: [{ type: "text", text }] };
}
