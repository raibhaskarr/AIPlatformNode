import type { Content, Part } from "@google/generative-ai";
import type { AiBinaryContent, AiContentPart, AiMessage } from "@pravnix/ai-core";

function mapBinary(data: AiBinaryContent, mimeType: string): Part {
  if ("base64" in data) {
    return { inlineData: { data: data.base64, mimeType } };
  }
  return { fileData: { fileUri: data.uri, mimeType } };
}

function mapContentPart(part: AiContentPart): Part {
  switch (part.type) {
    case "text":
      return { text: part.text };
    case "image":
    case "audio":
    case "video":
      return mapBinary(part.data, part.mimeType);
  }
}

/** Gemini uses "model" instead of "assistant"; `system` is passed separately as systemInstruction. */
export function mapMessages(messages: AiMessage[]): Content[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: m.content.map(mapContentPart),
    }));
}
