import {
  Briefcase,
  FileSignature,
  Gavel,
  HeartHandshake,
  Home,
  Landmark,
  PenLine,
  Scale,
  ShoppingBag,
  SplitSquareHorizontal,
  type LucideIcon,
} from "lucide-react";

/**
 * Suggested question chips for the consumer assistant (Part 4.1) — common
 * situations, phrased the way people actually arrive: mid-problem, in plain
 * language. Jurisdiction scoping happens in the system prompt, not here.
 */

export type SuggestedQuestion = {
  /** Short chip label. */
  label: string;
  /** The full question sent to the assistant when the chip is chosen. */
  question: string;
  icon: LucideIcon;
};

export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    label: "Tenant rights",
    question:
      "My landlord wants me to move out. What are my rights as a tenant, and what should I do first?",
    icon: Home,
  },
  {
    label: "Problem at work",
    question:
      "I think I'm being treated unfairly at work. What are my options and what should I document?",
    icon: Briefcase,
  },
  {
    label: "Before I sign a contract",
    question:
      "I've been given a contract to sign. What should I check before signing, and what are the warning signs?",
    icon: FileSignature,
  },
  {
    label: "Someone owes me money",
    question:
      "Someone owes me money and won't pay. How does small claims court work, and is it worth it?",
    icon: Gavel,
  },
  {
    label: "Family law basics",
    question:
      "Can you explain how separation and divorce generally work — the typical steps, timelines, and what to prepare?",
    icon: HeartHandshake,
  },
  {
    label: "Faulty product or refund",
    question:
      "A company refuses to refund me for a faulty product. What are my consumer rights and next steps?",
    icon: ShoppingBag,
  },
];

/** Research starters for the lawyer-side chat (Part 4.3 / Phase 7). */
export const RESEARCH_SUGGESTIONS: SuggestedQuestion[] = [
  {
    label: "Elements of a claim",
    question:
      "What are the elements of promissory estoppel in my jurisdiction, and the leading authority for each element?",
    icon: Scale,
  },
  {
    label: "Limitations period",
    question:
      "What is the statute of limitations for breach of a written contract here, when does it accrue, and what tolls it?",
    icon: Landmark,
  },
  {
    label: "Split of authority",
    question:
      "Is there a split of authority on the enforceability of browsewrap arbitration clauses? Separate settled points from open ones.",
    icon: SplitSquareHorizontal,
  },
  {
    label: "Draft a clause",
    question:
      "Draft a mutual indemnification clause for a B2B services agreement and flag every judgment call you make.",
    icon: PenLine,
  },
];
