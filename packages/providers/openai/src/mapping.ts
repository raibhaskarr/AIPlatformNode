import type OpenAI from "openai";
import { AiProviderError, createAiError, type AiBinaryContent, type AiContentPart, type AiMessage } from "@pravnix/ai-core";

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

function toDataUri(data: AiBinaryContent, mimeType: string): string {
  if ("base64" in data) return `data:${mimeType};base64,${data.base64}`;
  return data.uri;
}

function mapContentPart(part: AiContentPart): ContentPart {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return { type: "image_url", image_url: { url: toDataUri(part.data, part.mimeType) } };
    case "audio":
      if (!("base64" in part.data)) {
        throw new AiProviderError(
          createAiError("InvalidConfiguration", "OpenAI's input_audio content requires inline base64 audio data, not a URI.")
        );
      }
      return {
        type: "input_audio",
        input_audio: { data: part.data.base64, format: mimeTypeToAudioFormat(part.mimeType) },
      };
    case "video":
      throw new AiProviderError(
        createAiError("InvalidConfiguration", "OpenAI's Chat Completions API does not support video input. Use Gemini for this modality.")
      );
  }
}

function mimeTypeToAudioFormat(mimeType: string): "wav" | "mp3" {
  return mimeType.includes("wav") ? "wav" : "mp3";
}

export function mapMessages(systemPrompt: string | undefined, messages: AiMessage[]): ChatMessage[] {
  const mapped: ChatMessage[] = [];
  if (systemPrompt) {
    mapped.push({ role: "system", content: systemPrompt });
  }
  for (const message of messages) {
    if (message.role === "system") {
      mapped.push({ role: "system", content: message.content.map(mapContentPart).map((p) => (p.type === "text" ? p.text : "")).join("") });
      continue;
    }
    mapped.push({ role: message.role, content: message.content.map(mapContentPart) } as ChatMessage);
  }
  return mapped;
}
