"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import ProfileAvatar from "@/components/ProfileAvatar";
import { supabase } from "@/lib/supabase";
import { AVATAR_BUCKET, AVATAR_PREFIX, avatarStoragePath, prepareProfilePhoto, profilePhotoError } from "@/lib/profilePhoto";

export default function ProfilePhotoEditor({ userId, avatar, name, onSaved }: {
  userId: string; avatar: string | null; name: string; onSaved: (value: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function reset() { setFile(null); if (input.current) input.current.value = ""; }
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError(""); setNotice("");
    const invalid = profilePhotoError(selected);
    if (invalid) { setError(invalid); event.target.value = ""; return; }
    setFile(selected);
  }
  async function save(remove = false) {
    if (saving.current || (!remove && !file)) return;
    saving.current = true; setBusy(true); setError(""); setNotice("");
    let uploaded: string | null = null;
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || user?.id !== userId) throw new Error("Sua sessão mudou. Recarregue a página antes de alterar a foto.");
      if (!remove && file) {
        const blob = await prepareProfilePhoto(file);
        uploaded = `${userId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(uploaded, blob, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw new Error("Não foi possível enviar a foto. Tente novamente ou avise a administração.");
      }
      const value = uploaded ? AVATAR_PREFIX + uploaded : null;
      const { error: saveError } = await supabase.rpc("set_profile_avatar", { avatar_path: value });
      if (saveError) throw new Error("Não foi possível salvar a foto. Verifique sua conexão e tente novamente.");
      const oldPath = avatarStoragePath(avatar);
      onSaved(value); reset();
      setNotice(remove ? "Foto removida." : "Foto de perfil atualizada!");
      window.dispatchEvent(new Event("bonfire:avatar-updated"));
      // O banco impede apagar uma foto que ainda está vinculada a um perfil.
      if (oldPath?.startsWith(`${userId}/`)) void supabase.storage.from(AVATAR_BUCKET).remove([oldPath]).catch(() => {});
      uploaded = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha de conexão. Tente novamente.");
      // Mesmo se a resposta se perder, a política preserva a foto já salva.
      if (uploaded) void supabase.storage.from(AVATAR_BUCKET).remove([uploaded]).catch(() => {});
    } finally { saving.current = false; setBusy(false); }
  }
  return <section aria-label="Foto de perfil" className="mb-8 rounded-2xl border border-white/10 bg-white/[.035] p-5 md:p-6">
    <div className="flex flex-wrap items-center gap-5">
      <ProfileAvatar value={preview || avatar} name={name} className="h-20 w-20 text-3xl" />
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold">Foto de perfil</h2>
        <p id="profile-photo-help" className="mt-2 text-sm text-[#b9aaa0]">JPG, PNG ou WebP de até 20 MB. A foto será recortada no centro.</p>
        <label className={`mt-4 inline-flex cursor-pointer rounded-full border border-white/20 px-4 py-2 font-bold ${busy ? "pointer-events-none opacity-50" : "hover:bg-white/5"}`}>
          {avatar ? "Trocar foto" : "Adicionar foto"}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto de perfil" aria-describedby="profile-photo-help" disabled={busy} onChange={choose} className="sr-only" />
        </label>
        {avatar && !file && <button type="button" disabled={busy} onClick={() => void save(true)} className="ml-4 text-sm text-[#ffd19a] underline disabled:opacity-50">Remover foto</button>}
      </div>
    </div>
    {file && <div className="mt-5 flex flex-wrap items-center gap-3">
      <p className="w-full break-words text-sm text-[#b9aaa0]">Prévia da nova foto · {file.name}</p>
      <button type="button" disabled={busy} onClick={() => void save()} className="rounded-full bg-[#ff8a3d] px-5 py-2 font-bold text-[#21140e] disabled:opacity-50">{busy ? "Salvando…" : "Salvar foto"}</button>
      <button type="button" disabled={busy} onClick={() => { reset(); setError(""); }} className="rounded-full border border-white/20 px-5 py-2 disabled:opacity-50">Cancelar</button>
    </div>}
    {busy && !file && <p role="status" className="mt-4 text-sm">Removendo foto…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-[#ffd19a]">{notice}</p>}
  </section>;
}
