// Shared parsing helpers for OpenAI Responses API payloads.

export function extractOutputText(body: unknown): string {
  if (hasStringProperty(body, "output_text")) {
    return body.output_text;
  }

  const output = objectProperty(body, "output");
  if (Array.isArray(output)) {
    for (const item of output) {
      if (
        typeof item === "object" &&
        item !== null &&
        Array.isArray(item.content)
      ) {
        for (const content of item.content) {
          if (hasStringProperty(content, "text")) {
            return content.text;
          }
        }
      }
    }
  }

  throw new Error("OpenAI response returned no output text.");
}

// Failure detail for an OpenAI response whose body may not be JSON at all
// (gateway errors arrive as HTML pages); pass body === null for those.
export function openAiFailureDetail(
  body: unknown,
  status: number,
): string {
  return body === null
    ? `HTTP ${status} with a non-JSON response`
    : openAiErrorMessage(body);
}

export function openAiErrorMessage(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return "Unknown error";
}

export function openAiUsageTokens(body: unknown): {
  inputTokens: number | null;
  outputTokens: number | null;
} {
  const usage = objectProperty(body, "usage");
  const inputTokens = objectProperty(usage, "input_tokens");
  const outputTokens = objectProperty(usage, "output_tokens");

  return {
    inputTokens: typeof inputTokens === "number" ? inputTokens : null,
    outputTokens: typeof outputTokens === "number" ? outputTokens : null,
  };
}

function hasStringProperty<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, string> {
  const record = value as Record<string, unknown>;
  return (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof record[key] === "string"
  );
}

function objectProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return (value as Record<string, unknown>)[key];
}
