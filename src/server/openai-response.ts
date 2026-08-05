// Shared parsing helpers for OpenAI Responses API payloads.

import { parseRetryAfterSeconds } from "./retry-after";

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

// Retry-after hint for a 429 response: the HTTP `Retry-After` header when
// present, otherwise the delay embedded in OpenAI's error message. Null when
// neither carries one.
export function openAiRetryAfterSeconds(
  response: { headers: Headers },
  body: unknown,
): number | null {
  return parseRetryAfterSeconds(
    response.headers.get("retry-after"),
    openAiErrorMessage(body),
  );
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

export type OpenAiWebSearchCall = {
  // The action kind of the call, e.g. "search" or "open_page".
  action_type: string | null;
  // The query text for search actions; open_page/find_in_page actions have none.
  query: string | null;
};

/**
 * The web_search tool calls a Responses API answer actually executed, in
 * output order. Empty when the tool was attached but never used; callers that
 * never attached the tool should record null instead of calling this.
 */
export function openAiWebSearchCalls(body: unknown): OpenAiWebSearchCall[] {
  const output = objectProperty(body, "output");
  if (!Array.isArray(output)) return [];

  const calls: OpenAiWebSearchCall[] = [];
  for (const item of output) {
    if (
      typeof item !== "object" ||
      item === null ||
      (item as Record<string, unknown>).type !== "web_search_call"
    ) {
      continue;
    }
    const action = objectProperty(item, "action");
    const actionType = objectProperty(action, "type");
    const query = objectProperty(action, "query");
    calls.push({
      action_type: typeof actionType === "string" ? actionType : null,
      query: typeof query === "string" ? query : null,
    });
  }

  return calls;
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
