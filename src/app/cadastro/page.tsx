"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CadastroPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("aluno");
  const [className, setClassName] = useState("2º Informática");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Informe seu nome completo.");
      return;
    }

    if (!username.trim()) {
      setErrorMessage("Informe um nome de usuário.");
      return;
    }

    if (!email.trim()) {
      setErrorMessage("Informe seu e-mail.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
          role,
          class_name: className,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      "Conta criada com sucesso. Agora você já pode tentar fazer login.",
    );

    setTimeout(() => {
      router.push("/login");
    }, 1200);
  }

  return (
    <main className="min-h-screen bg-[#11100f] px-6 py-10 text-[#f6efe7]">
      <section className="mx-auto w-full max-w-2xl">
        <div className="mb-8">
          <Link className="text-sm text-[#ffd19a]" href="/login">
            ← Voltar para login
          </Link>

          <h1 className="mt-6 text-4xl font-black">Criar conta</h1>

          <p className="mt-2 text-[#b9aaa0]">
            Entre na comunidade escolar do Bonfire.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-6"
        >
          <div>
            <label className="mb-2 block text-sm text-[#b9aaa0]">
              Nome completo
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
              placeholder="Seu nome"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#b9aaa0]">
              Nome de usuário
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
              placeholder="@usuario"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-[#b9aaa0]">
              E-mail escolar
            </label>
            <input
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
              placeholder="seuemail@colegio.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-[#b9aaa0]">
                Tipo de usuário
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="coordenacao">Coordenação</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#b9aaa0]">Turma</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
              >
                <option>2º Informática</option>
                <option>1º Informática</option>
                <option>3º Informática</option>
                <option>Não se aplica</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-[#b9aaa0]">
                Senha
              </label>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
                placeholder="Digite uma senha"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-[#b9aaa0]">
                Confirmar senha
              </label>
              <input
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
                placeholder="Repita a senha"
                type="password"
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg border border-green-400/30 bg-green-400/10 px-4 py-3 text-sm text-green-200">
              {successMessage}
            </div>
          )}

          <button
            disabled={loading}
            className="mt-2 rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}