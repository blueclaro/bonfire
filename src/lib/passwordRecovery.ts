import type { SupabaseClient } from "@supabase/supabase-js";

type RecoveryAuth = Pick<SupabaseClient["auth"], "resetPasswordForEmail" | "setSession" | "getUser" | "updateUser" | "signOut">;
export const recoveryConfirmation = "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Confira também a pasta de spam.";
export const invalidRecoveryLink = "Este link é inválido, expirou ou já foi utilizado. Solicite um novo link.";

export function passwordError(password: string, confirmation: string) {
  if (password.length < 8) return "Use uma senha com pelo menos 8 caracteres.";
  if (password !== confirmation) return "As senhas não coincidem.";
  return "";
}

export async function requestRecovery(auth: RecoveryAuth, email: string, origin: string) {
  const clean = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error("Informe um e-mail válido.");
  const url = new URL("/redefinir-senha", origin);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Endereço do site inválido.");
  const { error } = await auth.resetPasswordForEmail(clean, { redirectTo: url.href });
  if (!error || error.code === "user_not_found") return recoveryConfirmation;
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    throw new Error("Muitas tentativas. Aguarde alguns minutos antes de solicitar outro link.");
  }
  throw new Error("Não foi possível solicitar o link. Verifique a conexão e tente novamente.");
}

// Usa exclusivamente a sessão obtida do link, nunca uma conta já aberta no navegador.
export function createPasswordRecovery(auth: RecoveryAuth) {
  let initialization: Promise<void> | null = null;
  let userId = "";
  let saving = false;
  let completed = false;
  return {
    initialize(url: string) {
      if (initialization) return initialization;
      initialization = (async () => {
        const parsed = new URL(url);
        const params = new URLSearchParams(parsed.hash.slice(1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (params.has("error") || parsed.searchParams.has("error") ||
            params.get("type") !== "recovery" || !access_token || !refresh_token) {
          throw new Error(invalidRecoveryLink);
        }
        const session = await auth.setSession({ access_token, refresh_token });
        if (session.error || !session.data.session) throw new Error(invalidRecoveryLink);
        const verified = await auth.getUser();
        if (verified.error || !verified.data.user || verified.data.user.id !== session.data.session.user.id) {
          throw new Error(invalidRecoveryLink);
        }
        userId = verified.data.user.id;
      })();
      return initialization;
    },
    async save(password: string, confirmation: string) {
      if (!userId || completed) throw new Error(invalidRecoveryLink);
      if (saving) throw new Error("Aguarde a atualização em andamento.");
      const validation = passwordError(password, confirmation);
      if (validation) throw new Error(validation);
      saving = true;
      try {
        const verified = await auth.getUser();
        if (verified.error || verified.data.user?.id !== userId) {
          userId = "";
          throw new Error(invalidRecoveryLink);
        }
        const { data, error } = await auth.updateUser({ password });
        if (error) {
          if (error.code === "same_password") throw new Error("Escolha uma senha diferente da senha atual.");
          if (error.code === "weak_password") throw new Error("A senha não atende às regras de segurança. Use uma senha mais forte.");
          throw new Error("Não foi possível atualizar a senha. Tente novamente ou solicite outro link.");
        }
        if (!data.user) throw new Error("Não foi possível confirmar a atualização da senha.");
        completed = true;
        userId = "";
        // A senha já foi alterada: uma falha ao encerrar a sessão não desfaz o sucesso.
        try { await auth.signOut({ scope: "local" }); } catch { /* sessão isolada não persistida */ }
      } finally { saving = false; }
    },
  };
}
