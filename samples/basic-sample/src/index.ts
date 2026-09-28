import { textMessage } from "@pravnix/ai-core";
import { createAiPlatform, createFakeProvider } from "@pravnix/ai-node";
import { z } from "zod";

async function main() {
  const { orchestrator } = createAiPlatform({
    providers: [
      createFakeProvider({
        responseSelector: (request) => {
          const lastText = request.messages.at(-1)?.content.find((c) => c.type === "text");
          if (lastText && lastText.type === "text" && lastText.text.includes("JSON")) {
            return '{"summary":"Ada made three technical claims.","claimCount":3}';
          }
          return "Hello from the fake provider!";
        },
      }),
    ],
    defaultProvider: "fake",
  });

  console.log("--- 1. Plain generate ---");
  const plain = await orchestrator.execute({
    name: "sample.greet",
    request: { messages: [textMessage("user", "Say hello.")] },
  });
  console.log(plain.success ? plain.response.text : plain.error);

  console.log("\n--- 2. Structured generate ---");
  const AnalysisSchema = z.object({ summary: z.string(), claimCount: z.number() });
  const structured = await orchestrator.executeStructured({
    name: "sample.analyze",
    request: { messages: [textMessage("user", "Respond with JSON analysis.")] },
    schema: AnalysisSchema,
  });
  console.log(structured.success ? structured.value : structured.error);

  console.log("\n--- 3. Streaming generate ---");
  let streamed = "";
  for await (const chunk of orchestrator.executeStream({
    name: "sample.stream",
    request: { messages: [textMessage("user", "Stream a greeting.")] },
  })) {
    streamed += chunk.delta;
  }
  console.log(streamed);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
