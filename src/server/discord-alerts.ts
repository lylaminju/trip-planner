import {
  ALERT_SEVERITY,
  type AlertEvent,
  type AlertSeverity,
} from "./alert-events";

// Discord renders embed colors from a decimal integer, not CSS, so these are
// third-party payload values rather than theme tokens.
const DISCORD_EMBED_COLOR: Record<AlertSeverity, number> = {
  [ALERT_SEVERITY.BUG]: 0xdc2626,
  [ALERT_SEVERITY.LIMIT]: 0xf59e0b,
};

const ALERT_TITLE_PREFIX: Record<AlertSeverity, string> = {
  [ALERT_SEVERITY.BUG]: "🐛",
  [ALERT_SEVERITY.LIMIT]: "📈",
};

// Discord rejects the whole webhook call when any single field overflows.
const DISCORD_DESCRIPTION_LIMIT = 4096;
const DISCORD_FIELD_VALUE_LIMIT = 1024;
const DISCORD_REQUEST_TIMEOUT_MS = 5000;

// Enough frames to name the failing module without burying the alert.
const STACK_PREVIEW_LINE_LIMIT = 6;

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function codeBlock(value: string): string {
  const fence = "```";
  return truncate(`${fence}\n${value}\n${fence}`, DISCORD_FIELD_VALUE_LIMIT);
}

type EmbedField = { name: string; value: string; inline?: boolean };

export type DiscordAlertPayload = {
  embeds: [
    {
      title: string;
      description: string;
      color: number;
      fields: EmbedField[];
      timestamp: string;
    },
  ];
};

export function buildDiscordAlertPayload(
  event: AlertEvent,
  suppressedCount: number,
  occurredAt: Date,
): DiscordAlertPayload {
  const fields: EmbedField[] = [];

  if (event.route) {
    fields.push({
      name: "Route",
      value: truncate(
        event.method ? `${event.method} ${event.route}` : event.route,
        DISCORD_FIELD_VALUE_LIMIT,
      ),
      inline: true,
    });
  }

  if (suppressedCount > 0) {
    fields.push({
      name: "Repeats",
      value: `${suppressedCount} more since the last alert`,
      inline: true,
    });
  }

  if (event.detail) {
    fields.push({
      name: "Upstream detail",
      value: truncate(event.detail, DISCORD_FIELD_VALUE_LIMIT),
    });
  }

  if (event.stack) {
    fields.push({
      name: "Stack",
      value: codeBlock(
        event.stack.split("\n").slice(0, STACK_PREVIEW_LINE_LIMIT).join("\n"),
      ),
    });
  }

  return {
    embeds: [
      {
        title: `${ALERT_TITLE_PREFIX[event.severity]} ${event.name}`,
        description: truncate(event.message, DISCORD_DESCRIPTION_LIMIT),
        color: DISCORD_EMBED_COLOR[event.severity],
        fields,
        timestamp: occurredAt.toISOString(),
      },
    ],
  };
}

// Alerting is diagnostic plumbing: a webhook outage, a timeout, or a malformed
// payload must never surface to the user or mask the original error, so every
// failure is swallowed after being logged locally.
export async function postDiscordAlert(
  webhookUrl: string,
  payload: DiscordAlertPayload,
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DISCORD_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        `Discord alert rejected with ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.warn("Discord alert delivery failed", error);
  }
}
