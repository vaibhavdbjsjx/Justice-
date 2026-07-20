import type { Deadline, Matter } from "@/lib/supabase/types";
import type { MatterDetail, MatterListItem } from "./queries";

/**
 * Sample matters shown ONLY in demo/preview mode (Supabase unconfigured), so
 * the matters UI is fully previewable locally — same philosophy as
 * getViewer()'s demo viewer (Phase 2). Mutations are disabled in preview;
 * chat still works live (unpersisted).
 */

const DEMO_USER = "00000000-0000-0000-0000-000000000000";
const now = () => new Date();
const iso = (d: Date) => d.toISOString();
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => {
  const d = now();
  d.setDate(d.getDate() + n);
  return d;
};

const demoMatterA: Matter = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: DEMO_USER,
  title: "Security deposit dispute — Maple St apartment",
  category: "tenant-housing",
  jurisdiction_country: "United States",
  jurisdiction_state: "California",
  status: "active",
  assigned_lawyer_id: null,
  created_at: iso(daysFromNow(-12)),
  updated_at: iso(daysFromNow(-1)),
};

const demoMatterB: Matter = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: DEMO_USER,
  title: "Freelance contract review — design retainer",
  category: "contracts",
  jurisdiction_country: "United States",
  jurisdiction_state: "California",
  status: "resolved",
  assigned_lawyer_id: null,
  created_at: iso(daysFromNow(-40)),
  updated_at: iso(daysFromNow(-9)),
};

const demoDeadlinesA: Deadline[] = [
  {
    id: "d1111111-1111-4111-8111-111111111111",
    matter_id: demoMatterA.id,
    title: "Send written deposit demand letter",
    due_date: dateOnly(daysFromNow(-2)),
    status: "completed",
    reminder_sent: false,
    created_at: iso(daysFromNow(-10)),
  },
  {
    id: "d2222222-2222-4222-8222-222222222222",
    matter_id: demoMatterA.id,
    title: "Landlord's 21-day deposit response window ends",
    due_date: dateOnly(daysFromNow(5)),
    status: "upcoming",
    reminder_sent: false,
    created_at: iso(daysFromNow(-10)),
  },
  {
    id: "d3333333-3333-4333-8333-333333333333",
    matter_id: demoMatterA.id,
    title: "File small claims case if no response",
    due_date: dateOnly(daysFromNow(19)),
    status: "upcoming",
    reminder_sent: false,
    created_at: iso(daysFromNow(-9)),
  },
];

export function demoMatterList(): MatterListItem[] {
  return [
    {
      ...demoMatterA,
      messageCount: 6,
      documentCount: 0,
      openDeadlines: demoDeadlinesA.filter((d) => d.status === "upcoming"),
    },
    { ...demoMatterB, messageCount: 9, documentCount: 0, openDeadlines: [] },
  ];
}

export function demoMatterDetail(id: string): MatterDetail | null {
  if (id === demoMatterA.id) {
    return {
      matter: demoMatterA,
      deadlines: demoDeadlinesA,
      messages: [
        {
          id: "m1",
          role: "user",
          content:
            "My old landlord hasn't returned my $2,400 security deposit and it's been three weeks since I moved out.",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "In **California**, a landlord generally has **21 days** after you move out to return your deposit or send an itemized statement of deductions.\n\nSince you're at three weeks, you're right at that boundary. A clear next step is a **written demand letter** — it often resolves this without court, and it strengthens a small-claims case if it doesn't.\n\nDid you receive any itemized list of deductions, or nothing at all?",
        },
      ],
    };
  }
  if (id === demoMatterB.id) {
    return { matter: demoMatterB, deadlines: [], messages: [] };
  }
  return null;
}
