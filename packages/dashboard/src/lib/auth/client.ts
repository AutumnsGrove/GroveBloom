/**
 * Better Auth Client
 *
 * Direct cookie-based auth integration with auth-api.grove.place.
 * Sessions are managed via httpOnly cookies set on .grove.place domain.
 */

const AUTH_BASE = "https://auth-api.grove.place";

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SessionResponse {
  user: User;
  session: Session;
}

/**
 * Start OAuth sign-in flow.
 * Redirects to the OAuth provider, then back to callbackURL.
 */
export function signIn(provider: "google" | "github" = "google", callbackURL?: string) {
  const redirect = encodeURIComponent(callbackURL ?? window.location.href);
  window.location.href = `${AUTH_BASE}/api/auth/sign-in/${provider}?callbackURL=${redirect}`;
}

/**
 * Sign out and clear session.
 * Redirects to home after sign-out.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  await fetch(`${AUTH_BASE}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = redirectTo;
}

/**
 * Get current session from server.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<SessionResponse | null> {
  try {
    const res = await fetch(`${AUTH_BASE}/api/auth/session`, {
      credentials: "include",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    // Better Auth returns empty object if no session
    if (!data.user || !data.session) {
      return null;
    }

    return data as SessionResponse;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated (client-side quick check).
 * For authoritative checks, use getSession().
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}
