import { useEffect, useState } from "react";

import {
  buildExportFilename,
  generateScheduledItineraryMarkdown,
} from "@/lib/itinerary-markdown";
import type { ItineraryView } from "@/lib/types";

type ExportFeedback = {
  action: "copy" | "download";
  kind: "error" | "success";
  label: string;
} | null;

type ItineraryExport = {
  exportFeedback: ExportFeedback;
  copyMarkdownExport: () => void;
  downloadMarkdownExport: () => void;
};

export function useItineraryExport(
  tripTitle: string,
  itinerary: ItineraryView,
): ItineraryExport {
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback>(null);

  useEffect(() => {
    if (!exportFeedback) return;

    const timeout = window.setTimeout(
      () => setExportFeedback(null),
      exportFeedback.kind === "error" ? 3500 : 2000,
    );

    return () => window.clearTimeout(timeout);
  }, [exportFeedback]);

  function setCopyFailedFeedback() {
    setExportFeedback({
      action: "copy",
      kind: "error",
      label: "Copy failed",
    });
  }

  function copyMarkdownExport() {
    try {
      const markdown = generateScheduledItineraryMarkdown(tripTitle, itinerary);

      navigator.clipboard
        .writeText(markdown)
        .then(() => {
          setExportFeedback({
            action: "copy",
            kind: "success",
            label: "Copied",
          });
        })
        .catch(() => {
          setCopyFailedFeedback();
        });
    } catch {
      setCopyFailedFeedback();
    }
  }

  function downloadMarkdownExport() {
    const markdown = generateScheduledItineraryMarkdown(tripTitle, itinerary);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = buildExportFilename(tripTitle);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportFeedback({
      action: "download",
      kind: "success",
      label: "Downloaded",
    });
  }

  return { exportFeedback, copyMarkdownExport, downloadMarkdownExport };
}
