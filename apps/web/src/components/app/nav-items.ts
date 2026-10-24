import {
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessagesSquare,
  PenLine,
  Search,
  Settings,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/supabase/types";
import { PAYMENTS_ENABLED } from "@/lib/billing/tiers";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  soon?: boolean;
};

const consumerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Assistant", href: "/chat", icon: MessagesSquare },
  { label: "Matters", href: "/matters", icon: FolderKanban },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Find a lawyer", href: "/find-a-lawyer", icon: Users },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Account", href: "/account", icon: Settings },
];

const lawyerNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Research", href: "/research", icon: Search },
  { label: "Drafting", href: "/drafting", icon: PenLine },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Account", href: "/account", icon: Settings },
];

export function navForRole(role: UserRole): NavItem[] {
  const items = role === "lawyer" ? lawyerNav : consumerNav;
  // Hide Billing on builds without in-app payments (App Store / Mac App Store).
  return PAYMENTS_ENABLED ? items : items.filter((i) => i.href !== "/billing");
}
