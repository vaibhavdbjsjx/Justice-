import { applyNotification, verifyNotification } from "@/lib/billing/apple";

/**
 * App Store Server Notifications V2: renewals, expiries, and refunds, including
 * those that happen while the app is closed. Set this URL in App Store Connect
 * under App Information > App Store Server Notifications, for both environments.
 */
export async function POST(request: Request): Promise<Response> {
  let signedPayload: unknown;
  try {
    ({ signedPayload } = (await request.json()) as { signedPayload?: unknown });
  } catch {
    return Response.json({ error: "Malformed payload." }, { status: 400 });
  }
  if (typeof signedPayload !== "string") {
    return Response.json({ error: "Malformed payload." }, { status: 400 });
  }

  let notification;
  try {
    notification = await verifyNotification(signedPayload);
  } catch (err) {
    console.error("[billing] App Store notification rejected:", err);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await applyNotification(notification);
  } catch (err) {
    console.error("[billing] App Store notification failed:", err);
    // Non-2xx makes Apple retry, which is right for transient failures.
    return Response.json({ error: "Handler failed." }, { status: 500 });
  }
  return Response.json({ received: true });
}
