import { getAppSessionUser } from "@/lib/auth/session";
import { loadProviderAccount, type ProviderAccountRecord } from "@/lib/provider-account";

export async function getCurrentUserAccount(): Promise<ProviderAccountRecord | null> {
  const currentUser = await getAppSessionUser();
  if (!currentUser || currentUser.role !== "job_provider" || !currentUser.providerId) {
    return null;
  }

  return loadProviderAccount(currentUser.providerId);
}
