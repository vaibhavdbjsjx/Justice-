/**
 * App Store products. Client-safe: the Flutter app reads these from
 * /api/app-config, and they must match App Store Connect exactly.
 */
export const APPLE_BUNDLE_ID =
  process.env.APPLE_BUNDLE_ID || "com.vaibhavsg.lexa";

export const APPLE_PRODUCTS = {
  plus: `${APPLE_BUNDLE_ID}.plus.monthly`,
  professional: `${APPLE_BUNDLE_ID}.professional.monthly`,
  plusYearly: `${APPLE_BUNDLE_ID}.plus.yearly`,
  professionalYearly: `${APPLE_BUNDLE_ID}.professional.yearly`,
} as const;

export function tierForAppleProduct(
  productId: string | undefined,
): "plus" | "professional" | null {
  if (productId === APPLE_PRODUCTS.plus || productId === APPLE_PRODUCTS.plusYearly) return "plus";
  if (productId === APPLE_PRODUCTS.professional || productId === APPLE_PRODUCTS.professionalYearly) {
    return "professional";
  }
  return null;
}
