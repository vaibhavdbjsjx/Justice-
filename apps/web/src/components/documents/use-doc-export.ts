"use client";

import { useState } from "react";

/**
 * Client-side download from POST /api/documents/export (Phase 6). Content
 * travels in the request, so unpersisted demo drafts export too. Shared by
 * the generated-doc and redline views (Phase 7).
 */
export function useDocExport() {
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  const download = async (
    title: string,
    bodyMarkdown: string,
    format: "pdf" | "docx",
  ) => {
    setError(null);
    setExporting(format);
    try {
      const res = await fetch("/api/documents/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body_markdown: bodyMarkdown, format }),
      });
      if (!res.ok) {
        let message = "That document couldn't be exported. Please try again.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // keep default
        }
        setError(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `document.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("That document couldn't be exported. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return { error, exporting, download };
}
