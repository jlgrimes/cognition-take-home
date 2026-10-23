import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PolicyError } from "@internal/platform/types";
import { PaymentsError } from "@internal/platform/connectors/payments";

/** Runs a mutation; policy failures become a flash message instead of a 500. */
export async function runAndRedirect(path: string, fn: () => unknown | Promise<unknown>, okMessage = "Saved"): Promise<never> {
  let error: string | null = null;
  try {
    await fn();
  } catch (e) {
    if (e instanceof PolicyError || e instanceof PaymentsError) error = e.message;
    else throw e;
  }
  revalidatePath(path);
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${error ? "error=" + encodeURIComponent(error) : "ok=" + encodeURIComponent(okMessage)}`);
}
