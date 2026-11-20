import { getViewer } from "@/lib/auth/session";
import { applyTransaction, verifyTransaction } from "@/lib/billing/apple";
import { getBillingStatus } from "@/lib/billing/status";

const MAX_TRANSACTIONS = 10;

/**
 * Called by the iOS app after a purchase, on restore, and at launch with the
 * signed transactions StoreKit reports as current. Nothing is trusted until it
 * verifies against Apple's root certificate.
 */
export async function POST(request: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!viewer.user) {
    return Response.json({ error: "Please sign in." }, { status: 401 });
  }

  let transactions: unknown;
  try {
    ({ transactions } = (await request.json()) as { transactions?: unknown });
  } catch {
    return Response.json({ error: "That request couldn't be read." }, { status: 400 });
  }
  if (!Array.isArray(transactions)) {
    return Response.json({ error: "That request couldn't be read." }, { status: 400 });
  }

  let failures = 0;
  for (const signed of transactions.slice(0, MAX_TRANSACTIONS)) {
    if (typeof signed !== "string") continue;
    try {
      const transaction = await verifyTransaction(signed);
      await applyTransaction(transaction, viewer.user.id);
    } catch (err) {
      failures += 1;
      console.error("[billing] App Store transaction rejected:", err);
    }
  }

  if (failures > 0 && failures >= transactions.length) {
    return Response.json(
      { error: "We couldn't confirm that purchase with the App Store. Please try Restore Purchases in a moment." },
      { status: 502 },
    );
  }
  return Response.json(await getBillingStatus(viewer));
}
