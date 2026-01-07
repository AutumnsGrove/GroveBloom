import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  // If already authenticated, redirect to home
  if (locals.user) {
    redirect(302, "/");
  }

  return {};
};
