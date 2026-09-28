import type { AiTelemetryEvent, AiTelemetrySink, ContentLoggingPolicy } from "@pravnix/ai-abstractions";

export interface ConsoleAiTelemetrySinkOptions {
  policy?: ContentLoggingPolicy;
  log?: (line: string) => void;
}

/**
 * Default sink: logs one line of metadata per call. `AiTelemetryEvent` structurally has no content
 * field, so "Redacted"/"DevelopmentFullContent" cannot be honored at this layer — a product that
 * genuinely needs content logging must build its own sink and opt in explicitly at the product
 * boundary, never here. "None" suppresses output entirely.
 */
export class ConsoleAiTelemetrySink implements AiTelemetrySink {
  private readonly policy: ContentLoggingPolicy;
  private readonly log: (line: string) => void;

  constructor(options: ConsoleAiTelemetrySinkOptions = {}) {
    this.policy = options.policy ?? "MetadataOnly";
    this.log = options.log ?? ((line) => console.log(line));
  }

  record(event: AiTelemetryEvent): void {
    if (this.policy === "None") return;
    this.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
  }
}

export class NoopAiTelemetrySink implements AiTelemetrySink {
  record(): void {}
}
