"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

const QUESTIONS = [
  {
    q: "Is Lexa a lawyer or a law firm?",
    a: "No. Lexa provides legal information to help you understand your situation and options. It isn't legal advice and doesn't create an attorney-client relationship. For anything important, confirm with a lawyer licensed where you live.",
  },
  {
    q: "How accurate are the answers?",
    a: "Lexa checks current sources where it can, favors statutes and official pages, and links to what it used. AI can still be wrong or out of date, and depth varies by country. Treat answers as a strong starting point, check the sources, and use Report if something looks off.",
  },
  {
    q: "What happens to my documents and questions?",
    a: "They're sent to our AI provider, with your permission, only to produce your answer. Original files are deleted right after they're read. You keep the analysis until you delete it, and you can delete your whole account at any time.",
  },
  {
    q: "Which countries does it cover?",
    a: "You can set any of 249 countries and territories. Coverage is deepest for the US, Canada, the UK, Australia, and India. Where Lexa has less detail, it stays general and tells you so.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Web plans cancel from your account. Plans bought in the iOS app cancel in your Apple account settings. The free plan never expires.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <Reveal>
          <h2 className="font-display text-center text-4xl text-foreground sm:text-5xl">
            Questions, answered plainly
          </h2>
        </Reveal>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {QUESTIONS.map(({ q, a }, i) => {
            const isOpen = open === i;
            return (
              <div key={q}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-[17px] font-medium text-foreground"
                  >
                    {q}
                    <Plus
                      className={cn(
                        "h-5 w-5 shrink-0 text-accent transition-transform duration-300 ease-[var(--ease-refined)]",
                        isOpen && "rotate-45",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-[var(--ease-refined)]",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 pr-9 text-[15px] leading-relaxed text-muted">{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
