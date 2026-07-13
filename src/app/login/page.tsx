"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Informe seu e-mail.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Informe sua senha.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#11100f] px-6 text-[#f6efe7]">
      <section className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff8a3d] text-3xl">
            🔥
          </div>

          <h1 className="text-4xl font-black">Bonfire</h1>

          <p className="mt-2 text-[#b9aaa0]">A rede social do seu colégio</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.045] p-6"
        >
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

          <div>
            <label className="mb-2 block text-sm text-[#b9aaa0]">Senha</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#ff8a3d]"
              placeholder="Digite sua senha"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-full bg-[#ff8a3d] px-5 py-3 font-bold text-[#21140e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="flex justify-between text-sm text-[#b9aaa0]">
            <Link className="hover:text-[#ffd19a]" href="/cadastro">
              Criar conta
            </Link>

            <a className="hover:text-[#ffd19a]" href="#">
              Esqueci a senha
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}