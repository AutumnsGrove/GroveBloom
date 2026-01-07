/**
 * User Auth Store
 *
 * Manages client-side user authentication state.
 * Syncs with Better Auth session on mount and provides reactive user state.
 */

import { getSession, signIn, signOut, type User, type Session } from "$lib/auth/client";

interface UserState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

function createUserStore() {
  let state = $state<UserState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  async function refresh() {
    state.loading = true;
    state.error = null;

    try {
      const data = await getSession();
      if (data) {
        state.user = data.user;
        state.session = data.session;
      } else {
        state.user = null;
        state.session = null;
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to fetch session";
      state.user = null;
      state.session = null;
    } finally {
      state.loading = false;
    }
  }

  function login(provider: "google" | "github" = "google") {
    signIn(provider);
  }

  function logout() {
    signOut("/");
  }

  return {
    get state() {
      return state;
    },
    get isAuthenticated() {
      return state.user !== null;
    },
    get isLoading() {
      return state.loading;
    },
    refresh,
    login,
    logout,
  };
}

export const user = createUserStore();
