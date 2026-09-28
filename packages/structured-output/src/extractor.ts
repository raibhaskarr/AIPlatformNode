const FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

/**
 * Strips a markdown code fence if present, otherwise scans for the outermost `{...}` or `[...]`
 * in case the model wrapped JSON in prose despite being asked not to. Never throws — a string
 * with no recognizable JSON shape is returned as-is so `JSON.parse` fails explicitly downstream.
 */
export function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(FENCE_RE);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  const firstBrace = candidate.indexOf("{");
  const firstBracket = candidate.indexOf("[");
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (starts.length === 0) {
    return candidate;
  }

  const start = Math.min(...starts);
  const openChar = candidate[start];
  const closeChar = openChar === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(closeChar);
  if (end === -1 || end < start) {
    return candidate;
  }

  return candidate.slice(start, end + 1);
}
