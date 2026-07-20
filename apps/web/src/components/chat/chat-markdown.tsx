import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for assistant messages, styled on the design system.
 * react-markdown does not render raw HTML by default (safe for AI output);
 * links open in a new tab. Kept deliberately quiet — chat is reading UI,
 * not a document (Fraunces stays reserved for document surfaces).
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-3">
      <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="text-[15px] leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline underline-offset-4 hover:opacity-80"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="ml-1 list-disc space-y-1.5 pl-4 text-[15px] leading-relaxed marker:text-accent">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="ml-1 list-decimal space-y-1.5 pl-4 text-[15px] leading-relaxed marker:font-medium marker:text-accent">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="pl-1">{children}</li>,
        h1: ({ children }) => (
          <h3 className="pt-1 text-base font-semibold text-foreground">{children}</h3>
        ),
        h2: ({ children }) => (
          <h3 className="pt-1 text-base font-semibold text-foreground">{children}</h3>
        ),
        h3: ({ children }) => (
          <h4 className="pt-1 text-[15px] font-semibold text-foreground">{children}</h4>
        ),
        h4: ({ children }) => (
          <h4 className="pt-1 text-[15px] font-semibold text-foreground">{children}</h4>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent pl-3 text-[15px] italic text-muted-strong">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[13px]">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-lg bg-surface-sunken p-3 font-mono text-[13px] leading-relaxed">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-border-strong px-3 py-2 text-left font-semibold text-foreground">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border px-3 py-2 align-top">{children}</td>
        ),
        hr: () => <hr className="border-border" />,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
