/**
 * SvelteKit Server Hooks
 *
 * Validates Better Auth sessions on the server side.
 * User and session data are available via event.locals.
 */

import type { Handle } from "@sveltejs/kit";

const AUTH_BASE = "https://auth-api.grove.place";

export const handle: Handle = async ({ event, resolve }) => {
  // Initialize locals
  event.locals.user = null;
  event.locals.session = null;

  // Forward cookies to Better Auth for session validation
  const cookie = event.request.headers.get("cookie");

  if (cookie) {
    try {
      const sessionRes = await fetch(`${AUTH_BASE}/api/auth/session`, {
        headers: { cookie },
      });

      if (sessionRes.ok) {
        const data = await sessionRes.json();

        // Better Auth returns empty object if no session
        if (data.user && data.session) {
          event.locals.user = data.user;
          event.locals.session = data.session;
        }
      }
    } catch {
      // Session validation failed - user remains unauthenticated
    }
  }

  return resolve(event);
};
