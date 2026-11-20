import "server-only";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPLE_BUNDLE_ID, tierForAppleProduct } from "./apple-products";

/**
 * App Store purchase verification. A purchase only counts once its signed
 * transaction verifies against Apple's root certificate here on the server: the
 * app never tells us "this user paid", it hands over Apple's proof.
 */

/** Apple Root CA - G3, from apple.com/certificateauthority. Public certificate.
 *  SHA-256 fingerprint 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79 */
const APPLE_ROOT_CA_G3 = Buffer.from(
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==",
  "base64",
);

/**
 * The numeric Apple ID shown on the app's App Store Connect page. Apple's library
 * requires it to verify production purchases, so real purchases can't verify
 * until it is set. Sandbox purchases, which App Review uses, work without it.
 */
const APPLE_APP_ID = Number(process.env.APPLE_APP_ID) || undefined;

/** StoreKit test transactions carry no Apple signature. Never honored in production. */
const allowLocalTransactions =
  process.env.NODE_ENV !== "production" &&
  process.env.APPLE_ALLOW_LOCAL_TRANSACTIONS === "true";

function verifiers(): SignedDataVerifier[] {
  const make = (environment: Environment) =>
    new SignedDataVerifier(
      [APPLE_ROOT_CA_G3],
      true,
      environment,
      APPLE_BUNDLE_ID,
      APPLE_APP_ID,
    );
  return [
    ...(APPLE_APP_ID ? [make(Environment.PRODUCTION)] : []),
    make(Environment.SANDBOX),
    ...(allowLocalTransactions
      ? [
          new SignedDataVerifier(
            [APPLE_ROOT_CA_G3],
            false,
            Environment.XCODE,
            APPLE_BUNDLE_ID,
            APPLE_APP_ID,
          ),
        ]
      : []),
  ];
}

async function firstVerified<T>(
  attempt: (verifier: SignedDataVerifier) => Promise<T>,
): Promise<T> {
  let lastError: unknown = new Error("No App Store verifier is available.");
  for (const verifier of verifiers()) {
    try {
      return await attempt(verifier);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export function verifyTransaction(
  signedTransaction: string,
): Promise<JWSTransactionDecodedPayload> {
  return firstVerified((v) => v.verifyAndDecodeTransaction(signedTransaction));
}

export function verifyNotification(
  signedPayload: string,
): Promise<ResponseBodyV2DecodedPayload> {
  return firstVerified((v) => v.verifyAndDecodeNotification(signedPayload));
}

function isTransactionActive(t: JWSTransactionDecodedPayload): boolean {
  if (t.revocationDate) return false;
  return typeof t.expiresDate === "number" && t.expiresDate > Date.now();
}

const FREE_STATE = {
  tier: "free" as const,
  status: "active",
  renews_at: null,
  source: null,
  apple_original_transaction_id: null,
  apple_product_id: null,
  apple_environment: null,
};

/**
 * Applies a verified transaction to an account. One App Store subscription backs
 * one Lexa account: restoring on a different account moves the plan there rather
 * than unlocking both. A live Stripe plan isn't overwritten, so someone who
 * subscribed on the web doesn't lose it to a lapsed App Store purchase.
 */
export async function applyTransaction(
  transaction: JWSTransactionDecodedPayload,
  userId: string,
): Promise<"plus" | "professional" | "free"> {
  const tier = tierForAppleProduct(transaction.productId);
  const originalId = transaction.originalTransactionId;
  if (!tier || !originalId) throw new Error("Unrecognized App Store product.");

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  const stripeActive = Boolean(
    existing?.stripe_subscription_id && existing.tier !== "free",
  );

  if (!isTransactionActive(transaction)) {
    if (
      existing?.apple_original_transaction_id === originalId &&
      !stripeActive
    ) {
      const { error } = await admin
        .from("subscriptions")
        .update(FREE_STATE)
        .eq("user_id", userId);
      if (error) throw error;
      return "free";
    }
    return stripeActive && existing ? (existing.tier as "plus") : "free";
  }

  const { error: releaseError } = await admin
    .from("subscriptions")
    .update(FREE_STATE)
    .eq("apple_original_transaction_id", originalId)
    .neq("user_id", userId);
  if (releaseError) throw releaseError;

  const keepStripeTier =
    stripeActive && existing?.tier === "professional" && tier === "plus";

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: keepStripeTier ? "professional" : tier,
      status: "active",
      renews_at: stripeActive
        ? existing?.renews_at
        : new Date(transaction.expiresDate as number).toISOString(),
      source: stripeActive ? "stripe" : "apple",
      apple_original_transaction_id: originalId,
      apple_product_id: transaction.productId,
      apple_environment: String(transaction.environment ?? ""),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return keepStripeTier ? "professional" : tier;
}

/** Handles an App Store Server Notification (renewal, expiry, refund, etc.). */
export async function applyNotification(
  notification: ResponseBodyV2DecodedPayload,
): Promise<void> {
  const signed = notification.data?.signedTransactionInfo;
  if (!signed) return;

  const transaction = await verifyTransaction(signed);
  const originalId = transaction.originalTransactionId;
  if (!originalId) return;

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("apple_original_transaction_id", originalId)
    .maybeSingle();
  if (error) throw error;

  const userId = row?.user_id ?? transaction.appAccountToken;
  if (userId) await applyTransaction(transaction, userId);
}
