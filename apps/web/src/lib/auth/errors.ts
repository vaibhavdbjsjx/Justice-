/**
 * Map raw auth errors to calm, professional copy (Part 8 — never expose raw
 * errors, never casual/playful language).
 */
export function friendlyAuthError(message?: string | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email or password doesn't match our records. Please try again.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address first — check your inbox for the link.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("password should be at least") || m.includes("weak password"))
    return "Please choose a stronger password (at least 8 characters).";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts just now. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch"))
    return "We couldn't reach the server. Check your connection and try again.";
  return "Something went wrong on our end. Please try again in a moment.";
}
