"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';
import { SocialAuthor, socialHandle } from '@/lib/social';
type Person = SocialAuthor & { id: string };
type Message = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string };
export default function DirectMessagesPage() {
  const [user, setUser] = useState('');
  const [target, setTarget] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const version = useRef(0), sending = useRef(false);
  const account = useRef('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user) throw new Error();
        if (!live) return;
        const uid = auth.data.user.id; account.current = uid; setUser(uid);
        const result = await supabase.from('direct_messages').select('sender_id,recipient_id').order('created_at', { ascending: false }).limit(100);
        if (result.error) throw result.error;
        const ids = [...new Set((result.data || []).map(row => row.sender_id === uid ? row.recipient_id : row.sender_id))];
        const requested = new URLSearchParams(window.location.search).get('para');
        if (requested && /^[0-9a-f-]{36}$/.test(requested) && requested !== uid && !ids.includes(requested)) ids.unshift(requested);
        if (ids.length) {
          const profiles = await supabase.from('profiles').select('id,username,display_name,temporary_tag,avatar_url').in('id', ids);
          if (profiles.error) throw profiles.error;
          if (live) { setPeople(profiles.data || []); setTarget(profiles.data?.find(p => p.id === requested) || null); }
        }
      } catch { if (live) setError('Não foi possível carregar mensagens. Entre na sua conta e confira se a migração social foi aplicada.'); }
      finally { if (live) setLoading(false); }
    })();
    const {data:listener} = supabase.auth.onAuthStateChange((event,session) => {
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && account.current && session?.user.id !== account.current)) { live=false; version.current++; setUser(''); setTarget(null); setMessages([]); setPeople([]); setContent(''); setLoading(false); }
    });
    return () => { live = false; listener.subscription.unsubscribe(); };
  }, []);
  const refresh = useCallback(async () => {
    if (!user || !target) return;
    const current = ++version.current;
    try {
      const [rows, block, permission] = await Promise.all([
        supabase.from('direct_messages').select('*').or(`and(sender_id.eq.${user},recipient_id.eq.${target.id}),and(sender_id.eq.${target.id},recipient_id.eq.${user})`).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100),
        supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user).eq('blocked_id', target.id),
        supabase.rpc('can_message', { target: target.id }),
      ]);
      if (rows.error || block.error || permission.error) throw new Error();
      if (current !== version.current) return;
      setMessages((rows.data || []).reverse()); setBlocked(!!block.data?.length); setAllowed(!!permission.data);
    } catch { if (current === version.current) setError('Não foi possível atualizar esta conversa.'); }
  }, [user, target]);
  useEffect(() => {
    setMessages([]); setContent(''); setAllowed(false); setBlocked(false);
    void refresh(); const timer = setInterval(() => void refresh(), 10000);
    return () => { version.current++; clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  async function search(e: FormEvent) {
    e.preventDefault(); if (query.trim().length < 2) { setError('Digite pelo menos 2 caracteres do nome.'); return; }
    setBusy(true); setError('');
    try {
      const term = query.trim().replace(/[\\%_]/g, '\\$&');
      const result = await supabase.from('profiles').select('id,username,display_name,temporary_tag,avatar_url').ilike('display_name', `%${term}%`).neq('id', user).limit(20);
      if (result.error) throw result.error; setPeople(result.data || []);
    } catch { setError('Não foi possível buscar pessoas.'); } finally { setBusy(false); }
  }
  async function send(e: FormEvent) {
    e.preventDefault(); if (!target || sending.current || !content.trim() || !allowed) return;
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await supabase.from('direct_messages').insert({ sender_id: user, recipient_id: target.id, content: content.trim() });
      if (result.error) throw result.error; setContent(''); await refresh();
    } catch { setError('Mensagem não enviada. A conta pode ter expirado ou a conversa estar bloqueada.'); }
    finally { sending.current = false; setBusy(false); }
  }
  async function toggleBlock() {
    if (!target || busy) return; setBusy(true); setError('');
    try {
      const result = blocked ? await supabase.from('user_blocks').delete().eq('blocker_id', user).eq('blocked_id', target.id) : await supabase.from('user_blocks').insert({ blocker_id: user, blocked_id: target.id });
      if (result.error) throw result.error; await refresh();
    } catch { setError('Não foi possível alterar o bloqueio.'); } finally { setBusy(false); }
  }
  return <main className="app-shell grid min-h-screen xl:grid-cols-[260px_minmax(0,1fr)]"><Sidebar active="mensagens" showRooms={false}/><section className="mx-auto w-full max-w-5xl p-4 md:p-8">
    <h1 className="text-3xl font-black">Mensagens</h1><p className="mt-2 text-sm text-[#b9aaa0]">Conversas individuais. Somente você e o destinatário podem ler pelo aplicativo.</p>
    {error && <p role="alert" className="my-4 text-red-200">{error}</p>}{loading && <p className="mt-4">Carregando…</p>}{!user && !loading && <Link href="/login" className="text-[#ffd19a] underline">Entrar</Link>}
    {user && <div className="mt-6 grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]"><aside><form onSubmit={search}><label className="text-sm">Buscar pessoa pelo nome<input value={query} onChange={e => setQuery(e.target.value)} maxLength={60} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3"/></label><button disabled={busy} className="mt-2 min-h-11 text-[#ffd19a]">Buscar</button></form><div className="mt-3 flex gap-2 overflow-x-auto md:block md:space-y-2">{people.map(person => <button disabled={busy} key={person.id} onClick={() => {setTarget(person);setError('');}} className={`block min-w-40 rounded-xl border p-3 text-left text-sm [overflow-wrap:anywhere] md:w-full ${target?.id === person.id ? 'border-[#ff8a3d]' : 'border-white/10'}`}>{socialHandle(person)}</button>)}</div>{!people.length && <p className="mt-3 text-sm text-[#b9aaa0]">Busque alguém para começar uma conversa.</p>}</aside>
      {target ? <section className="flex h-[70dvh] min-h-96 flex-col overflow-hidden rounded-2xl border border-white/10"><header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4"><Link href={`/pessoas/${target.id}`} className="break-all font-bold text-[#ffd19a]">{socialHandle(target)}</Link><button disabled={busy} onClick={() => void toggleBlock()} className="min-h-11 text-xs underline">{blocked ? 'Desbloquear' : 'Bloquear'}</button></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"><p className="text-xs text-[#b9aaa0]">Últimas 100 mensagens · Atualização a cada 10 segundos</p>{messages.map(message => <div key={message.id} className={`max-w-[90%] rounded-2xl p-3 ${message.sender_id === user ? 'ml-auto bg-[#ff8a3d] text-[#21140e]' : 'bg-white/10'}`}><p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p><time className="mt-1 block text-right text-xs opacity-70">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(message.created_at))}</time></div>)}{!messages.length && <p className="text-sm text-[#b9aaa0]">Nenhuma mensagem nesta conversa.</p>}<div ref={end}/></div>{!allowed && <p className="px-4 text-sm text-[#ffd19a]">Conversa indisponível para envio: conta inativa ou bloqueio.</p>}<form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3"><input aria-label="Mensagem privada" value={content} onChange={e => setContent(e.target.value)} disabled={!allowed || busy} maxLength={2000} placeholder="Sua mensagem…" className="min-w-0 flex-1 rounded-full bg-white/5 px-4 py-3"/><button disabled={!allowed || busy || !content.trim()} className="shrink-0 rounded-full bg-[#ff8a3d] px-4 py-3 font-bold text-[#21140e] disabled:opacity-50">Enviar</button></form></section> : <p className="rounded-2xl border border-dashed border-white/10 p-6 text-[#b9aaa0]">Escolha uma pessoa para conversar.</p>}
    </div>}
  </section></main>;
}
