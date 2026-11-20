import { getViewer } from "@/lib/auth/session";
import { getBillingStatus } from "@/lib/billing/status";

/** Current plan and allowances for the signed-in user. */
export async function GET(): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }
  return Response.json(await getBillingStatus(viewer));
}
