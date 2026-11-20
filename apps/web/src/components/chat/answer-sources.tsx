"use client";

import { useRef, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { StreamMeta } from "@/lib/ai/stream-meta";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Where a grounded answer came from. Google's terms require its Search
 * Suggestions widget to appear unmodified, at the width of the answer, whenever
 * the answer does. It renders in a sandboxed frame so its markup can't touch the
 * app, and scripts stay off because the widget is static.
 */
export function AnswerSources({ meta }: { meta: StreamMeta }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(72);

  return (
    <div className="mt-3 space-y-2.5 border-t border-border pt-3">
      {meta.sources.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Search className="h-3 w-3" aria-hidden="true" />
            Sources
          </p>
          <ul className="space-y-1">
            {meta.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex max-w-full items-center gap-1.5 text-[13px] text-accent underline-offset-4 hover:underline"
                >
                  <span className="truncate">{source.title || hostname(source.url)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {meta.searchSuggestionsHtml && (
        <iframe
          ref={frame}
          title="Google Search suggestions"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={`<!doctype html><base target="_blank"><body style="margin:0">${meta.searchSuggestionsHtml}</body>`}
          onLoad={() => {
            const height = frame.current?.contentDocument?.body?.scrollHeight;
            if (height) setFrameHeight(height);
          }}
          style={{ height: frameHeight }}
          className="w-full border-0"
        />
      )}
    </div>
  );
}
