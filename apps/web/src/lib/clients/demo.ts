import "server-only";
import type {
  ClientMessage,
  Deadline,
  DocumentRow,
  IntakeLink,
  Matter,
} from "@/lib/supabase/types";
import type { IntakeBriefAnnotations } from "@/lib/intake/types";
import type { ClientMatterDetail, ClientMatterListItem } from "./queries";

/**
 * Demo fixtures for the lawyer-side clients workspace (Phase 8), used ONLY
 * when Supabase is unconfigured so the UI is previewable locally.
 */

const DEMO_LAWYER_ID = "00000000-0000-0000-0000-000000000000";
const CLIENT_1 = "00000000-0000-0000-0000-0000000000c1";
const MATTER_1 = "00000000-0000-0000-0000-0000000000a1";
const CLIENT_2 = "00000000-0000-0000-0000-0000000000c2";
const MATTER_2 = "00000000-0000-0000-0000-0000000000a2";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const matter1: Matter = {
  id: MATTER_1,
  user_id: CLIENT_1,
  title: "Eviction defense — 7-day notice",
  category: "tenant-housing",
  jurisdiction_country: "United States",
  jurisdiction_state: "California",
  status: "active",
  assigned_lawyer_id: DEMO_LAWYER_ID,
  created_at: daysAgo(2),
  updated_at: daysAgo(1),
};

const matter2: Matter = {
  id: MATTER_2,
  user_id: CLIENT_2,
  title: "Unpaid final invoice — web design contract",
  category: "small-claims",
  jurisdiction_country: "United States",
  jurisdiction_state: "California",
  status: "active",
  assigned_lawyer_id: DEMO_LAWYER_ID,
  created_at: daysAgo(9),
  updated_at: daysAgo(3),
};

const brief1: IntakeBriefAnnotations = {
  kind: "intake_brief",
  title: "Eviction defense — 7-day notice",
  summary:
    "Tenant of four years received a 7-day notice to vacate after requesting repairs in writing. No prior lease violations claimed; rent is current. Client believes the notice is retaliatory and wants to remain in the unit. A court date has not been set.",
  key_facts: [
    "Tenancy began four years ago; rent is current.",
    'Client requested mold remediation in writing "about three weeks ago".',
    "7-day notice to vacate was posted on the door last Friday.",
    "No prior notices or violation claims mentioned.",
  ],
  timeline: [
    { date_text: "about three weeks ago", event: "Written repair request (mold) sent to landlord" },
    { date_text: "last Friday", event: "7-day notice to vacate posted on door" },
  ],
  urgency: "high",
  urgency_reason: "The stated notice period is 7 days and part of it has already run.",
  complexity_note:
    "Facts as stated suggest a retaliation defense; complexity depends on the landlord's asserted grounds and local just-cause rules.",
  questions_for_client: [
    "What exact date does the notice give, and what reason (if any) does it state?",
    "Do you have the written repair request and any landlord replies?",
    "Has the landlord entered or attempted entry since the notice?",
  ],
  suggested_next_steps: [
    "Obtain the notice itself and verify service method and dates.",
    "Preserve the written repair request thread.",
    "Check local just-cause and retaliation presumption windows.",
  ],
  jurisdiction_note:
    "California tenants benefit from a statutory retaliation presumption within 180 days of a repair request.",
  intake: {
    situation:
      "My landlord taped a 7-day notice to my door last Friday. Three weeks ago I asked in writing for mold to be fixed in the bathroom. I've paid rent on time for four years. I think this is retaliation and I don't want to lose my home.",
    category: "tenant-housing",
    country: "United States",
    state: "California",
    urgency: "urgent",
    key_dates: "Notice posted last Friday; repair request about three weeks ago",
    desired_outcome: "Stay in my home and get the mold fixed.",
  },
};

const briefDoc1: DocumentRow = {
  id: "00000000-0000-0000-0000-0000000000d1",
  matter_id: MATTER_1,
  uploaded_by: CLIENT_1,
  type: "generated",
  title: "Case brief — Eviction defense — 7-day notice",
  file_url: null,
  extracted_text: brief1.summary,
  ai_annotations: brief1 as unknown as DocumentRow["ai_annotations"],
  created_at: daysAgo(2),
};

const deadlines1: Deadline[] = [
  {
    id: "00000000-0000-0000-0000-0000000000e1",
    matter_id: MATTER_1,
    title: "Verify notice expiry date",
    due_date: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    status: "upcoming",
    reminder_sent: false,
    created_at: daysAgo(1),
  },
];

const messages1: ClientMessage[] = [
  {
    id: "00000000-0000-0000-0000-0000000000f1",
    matter_id: MATTER_1,
    sender_id: DEMO_LAWYER_ID,
    body: "Thanks for the detailed intake. Could you photograph the notice on the door (or a copy of it) and upload it here?",
    created_at: daysAgo(1),
  },
  {
    id: "00000000-0000-0000-0000-0000000000f2",
    matter_id: MATTER_1,
    sender_id: CLIENT_1,
    body: "Just uploaded it. The notice says I have to be out by next Wednesday and doesn't give a reason.",
    created_at: daysAgo(0.5),
  },
];

export function demoIntakeLinks(): IntakeLink[] {
  return [
    {
      id: "00000000-0000-0000-0000-0000000000b1",
      lawyer_id: DEMO_LAWYER_ID,
      token: "demo-intake-token",
      label: "Website footer",
      revoked_at: null,
      created_at: daysAgo(30),
    },
  ];
}

export function demoClientMatters(): ClientMatterListItem[] {
  return [
    {
      matter: matter1,
      clientName: "Dana Whitfield",
      clientId: CLIENT_1,
      linkStatus: "active",
      sharedAt: daysAgo(2),
    },
    {
      matter: matter2,
      clientName: "Marcus Oyelaran",
      clientId: CLIENT_2,
      linkStatus: "active",
      sharedAt: daysAgo(9),
    },
  ];
}

export function demoClientMatterDetail(
  matterId: string,
): ClientMatterDetail | null {
  if (matterId !== MATTER_1) {
    const item = demoClientMatters().find((m) => m.matter.id === matterId);
    if (!item) return null;
    return {
      ...item,
      briefDocument: null,
      documents: [],
      deadlines: [],
      messages: [],
    };
  }
  return {
    ...demoClientMatters()[0],
    briefDocument: briefDoc1,
    documents: [],
    deadlines: deadlines1,
    messages: messages1,
  };
}
