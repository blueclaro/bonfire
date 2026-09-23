const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const source = readFileSync(resolve(__dirname, "../src/lib/passwordRecovery.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const api = {};
runInNewContext(compiled, { exports: api, URL, URLSearchParams });
const link = "https://bonfire.test/redefinir-senha#type=recovery&access_token=test-access&refresh_token=test-refresh";
function fixture() {
  const calls = [];
  const user = { id: "recovery-user" };
  const auth = {
    resetPasswordForEmail: async (...args) => { calls.push(["request", ...args]); return { error: null }; },
    setSession: async tokens => { calls.push(["session", tokens]); return { data: { session: { user } }, error: null }; },
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async payload => { calls.push(["update", payload]); return { data: { user }, error: null }; },
    signOut: async scope => { calls.push(["signOut", scope]); return { error: null }; },
  };
  return { auth, calls };
}
test("recuperação envia e-mail limpo e redirecionamento fixo no mesmo domínio", async () => {
  const { auth, calls } = fixture();
  assert.equal(await api.requestRecovery(auth, " pessoa@example.test ", "https://bonfire.test"), api.recoveryConfirmation);
  assert.equal(calls[0][1], "pessoa@example.test");
  assert.equal(calls[0][2].redirectTo, "https://bonfire.test/redefinir-senha");
  await assert.rejects(api.requestRecovery(auth, "inválido", "https://bonfire.test"), /e-mail válido/);
});
test("conta inexistente recebe a mesma confirmação; limite de envio não revela detalhes", async () => {
  const { auth } = fixture();
  auth.resetPasswordForEmail = async () => ({ error: { code: "user_not_found" } });
  assert.equal(await api.requestRecovery(auth, "a@example.test", "https://bonfire.test"), api.recoveryConfirmation);
  auth.resetPasswordForEmail = async () => ({ error: { status: 429 } });
  await assert.rejects(api.requestRecovery(auth, "a@example.test", "https://bonfire.test"), /Muitas tentativas/);
  auth.resetPasswordForEmail = async () => ({ error: { message: "internal secret" } });
  await assert.rejects(api.requestRecovery(auth, "a@example.test", "https://bonfire.test"), /Não foi possível solicitar/);
});
test("nega acesso direto, links incompletos, expirados e outros tipos de autenticação", async () => {
  for (const url of [
    "https://bonfire.test/redefinir-senha",
    link.replace("type=recovery", "type=signup"),
    "https://bonfire.test/#error=access_denied&error_code=otp_expired",
    "https://bonfire.test/#type=recovery&access_token=a",
    link.replace("#", "?error=access_denied#"),
  ]) {
    const { auth, calls } = fixture();
    const flow = api.createPasswordRecovery(auth);
    await assert.rejects(flow.initialize(url), /link é inválido/);
    await assert.rejects(flow.save("password123", "password123"), /link é inválido/);
    assert.equal(calls.length, 0);
  }
});
test("valida sessão com servidor e reutiliza inicialização, inclusive em Strict Mode", async () => {
  const { auth, calls } = fixture();
  const flow = api.createPasswordRecovery(auth);
  await Promise.all([flow.initialize(link), flow.initialize(link)]);
  assert.equal(calls.filter(c => c[0] === "session").length, 1);
  await flow.save("password123", "password123");
  assert.equal(calls.find(c => c[0] === "update")[1].password, "password123");
  assert.equal(calls.find(c => c[0] === "signOut")[1].scope, "local");
  await assert.rejects(flow.save("password123", "password123"), /link é inválido/);
});
test("sessão inválida ou usuário diferente impede atualizar senha", async () => {
  const { auth, calls } = fixture();
  auth.getUser = async () => ({ data: { user: { id: "outra-conta" } }, error: null });
  await assert.rejects(api.createPasswordRecovery(auth).initialize(link), /link é inválido/);
  assert.equal(calls.filter(c => c[0] === "update").length, 0);
  auth.setSession = async () => ({ data: { session: null }, error: { message: "invalid" } });
  await assert.rejects(api.createPasswordRecovery(auth).initialize(link), /link é inválido/);
});
test("revalida usuário antes de salvar e rejeita senhas curtas ou divergentes", async () => {
  const { auth, calls } = fixture();
  const flow = api.createPasswordRecovery(auth);
  await flow.initialize(link);
  await assert.rejects(flow.save("123", "123"), /8 caracteres/);
  await assert.rejects(flow.save("password123", "outra-senha"), /não coincidem/);
  auth.getUser = async () => ({ data: { user: null }, error: { message: "expired" } });
  await assert.rejects(flow.save("password123", "password123"), /link é inválido/);
  assert.equal(calls.filter(c => c[0] === "update").length, 0);
});
test("erros de atualização não indicam sucesso e permitem corrigir a senha", async () => {
  const { auth, calls } = fixture();
  const flow = api.createPasswordRecovery(auth);
  await flow.initialize(link);
  auth.updateUser = async () => ({ data: { user: null }, error: { code: "same_password" } });
  await assert.rejects(flow.save("password123", "password123"), /diferente/);
  auth.updateUser = async () => ({ data: { user: null }, error: { code: "weak_password" } });
  await assert.rejects(flow.save("password123", "password123"), /mais forte/);
  assert.equal(calls.filter(c => c[0] === "signOut").length, 0);
});
test("bloqueia envio duplicado e preserva sucesso se saída da sessão falhar", async () => {
  const { auth, calls } = fixture();
  const flow = api.createPasswordRecovery(auth);
  await flow.initialize(link);
  auth.signOut = async () => { throw new Error("offline"); };
  const saving = flow.save("password123", "password123");
  await assert.rejects(flow.save("password123", "password123"), /Aguarde/);
  await saving;
  assert.equal(calls.filter(c => c[0] === "update").length, 1);
});
