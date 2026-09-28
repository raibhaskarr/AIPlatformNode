export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface AiModelDescriptor {
  provider: string;
  model: string;
}

export interface AiResponse {
  text: string;
  model: AiModelDescriptor;
  usage: AiUsage;
  finishReason: string;
}

/** New relative to the .NET platform: built in from day one per the streaming divergence. */
export interface AiStreamChunk {
  delta: string;
  done: boolean;
  usage?: AiUsage;
}
