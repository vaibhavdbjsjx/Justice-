import { redirect } from "next/navigation";

/** Marketing CTA entry point → sign-up, preserving any plan selection. */
export default async function GetStartedPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  redirect(plan ? `/sign-up?plan=${encodeURIComponent(plan)}` : "/sign-up");
}
