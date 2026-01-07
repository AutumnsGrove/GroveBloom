// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}

    interface Locals {
      user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        emailVerified: boolean;
        createdAt: string;
        updatedAt: string;
      } | null;
      session: {
        id: string;
        userId: string;
        expiresAt: string;
        createdAt: string;
        updatedAt: string;
        ipAddress: string | null;
        userAgent: string | null;
      } | null;
    }

    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env?: {
        // Cloudflare bindings if needed
      };
    }
  }
}

export {};
