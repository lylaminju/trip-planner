import { useResolvedPlaceName } from "@/hooks/useResolvedPlaceName";

export function UrlPreviewHint({
  tripId,
  url,
  idleHint,
}: {
  tripId: number;
  url: string;
  idleHint: string;
}) {
  const preview = useResolvedPlaceName(tripId, url);

  if (preview.status === "resolving") {
    return (
      <span className="ai-field-hint" role="status">
        Looking up place…
      </span>
    );
  }
  if (preview.status === "resolved") {
    return (
      <span className="ai-field-hint ai-field-hint-success" role="status">
        ✓ {preview.name}
      </span>
    );
  }
  if (preview.status === "error") {
    return (
      <span className="ai-field-hint ai-field-hint-danger" role="status">
        {preview.message}
      </span>
    );
  }

  return <span className="ai-field-hint">{idleHint}</span>;
}
