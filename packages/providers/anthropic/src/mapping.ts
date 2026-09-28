import type Anthropic from "@anthropic-ai/sdk";
import { AiProviderError, createAiError, type AiBinaryContent, type AiContentPart, type AiMessage } from "@pravnix/ai-core";

type AnthropicContentBlock = Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam;
type AnthropicMessageParam = Anthropic.Messages.MessageParam;
type AnthropicImageMediaType = Anthropic.Messages.ImageBlockParam.Source["media_type"];

function toBase64(data: AiBinaryContent): string {
  if ("base64" in data) return data.base64;
  throw new AiProviderError(
    createAiError("InvalidConfiguration", "Claude's Messages API requires inline base64 image data, not a URI.")
  );
}

function mapContentPart(part: AiContentPart): AnthropicContentBlock {
  switch (part.type) {
    case "text":
      return { type: "text", text: part.text };
    case "image":
      return {
        type: "image",
        source: { type: "base64", media_type: part.mimeType as AnthropicImageMediaType, data: toBase64(part.data) },
      };
    case "audio":
    case "video":
      throw new AiProviderError(
        createAiError(
          "InvalidConfiguration",
          `Claude's Messages API does not support ${part.type} input. Use Gemini or OpenAI for this modality.`
        )
      );
  }
}

/**
 * Anthropic's Messages API only knows "user"/"assistant" turns — `system` is a top-level field,
 * mapped separately in the provider.
 */
export function mapMessages(messages: AiMessage[]): AnthropicMessageParam[] {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.map(mapContentPart),
    }));
}
