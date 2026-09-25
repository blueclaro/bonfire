import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const projectRef = url ? new URL(url).hostname.split(".")[0] : "";
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : "";

export const isSupabaseConfigured = Boolean(url && key);
export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  key ?? "placeholder-public-key",
);

/** Remove também sessões órfãs cujo usuário ou perfil já foi excluído no Supabase. */
export async function clearLocalAuthSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    if (typeof window === "undefined" || !authStorageKey) return;
    window.localStorage.removeItem(authStorageKey);
    window.localStorage.removeItem(`${authStorageKey}-user`);
    for (let index = window.localStorage.length - 1; index >= 0; index--) {
      const storedKey = window.localStorage.key(index);
      if (storedKey?.startsWith(`${authStorageKey}-code-verifier`)) window.localStorage.removeItem(storedKey);
    }
  }
}
