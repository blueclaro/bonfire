"use client";
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { extractHashtags, FEED_CATEGORY, preparePostImage, publicationError, SocialAuthor, socialHandle } from '@/lib/social';
import SignedPostImage from '@/components/SignedPostImage';
import ReportButton from '@/components/ReportButton';
import Avatar from '@/components/SocialAvatar';
import ReactionIcon from '@/components/ReactionIcon';
import SparkThread from '@/components/SparkThread';
import StaffRemoveSpark from '@/components/StaffRemoveSpark';

type Entry = { event_id: string; id: string; title: string; content: string; image_path: string | null; author_id: string; author: SocialAuthor | null; igniter: SocialAuthor | null; created_at: string; event_at: string; is_locked: boolean; can_ignite: boolean; likes: number; comments: number; ignites: number; liked: boolean; ignited: boolean };
export default function SocialFeed() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [filter, setFilter] = useState('');
  const [more, setMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [animation, setAnimation] = useState<{eventId:string;kind:string;key:number} | null>(null);
  const [expanded,setExpanded]=useState<string[]>([]);
  const [viewerRole,setViewerRole]=useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const sending = useRef(false);
  const acting = useRef(false);
  const account = useRef('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const load = useCallback(async (start = 0) => {
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const auth = await supabase.auth.getUser();
      if (version !== request.current) return;
      if (!auth.data.user) { setUserId(''); setEntries([]); if (auth.error && auth.error.name !== 'AuthSessionMissingError') throw auth.error; return; }
      account.current = auth.data.user.id; setUserId(auth.data.user.id);
      const [result,profile]=await Promise.all([supabase.rpc('social_feed', {page_offset:start, hashtag}),supabase.from('profiles').select('role').eq('id',auth.data.user.id).single()]);
      if (result.error) throw result.error; setViewerRole(profile.data?.role||'');
      if (version !== request.current) return;
      const next = result.data as Entry[];
      setEntries(previous => start ? [...previous, ...next.filter(item => !previous.some(old => old.event_id === item.event_id))] : next);
      setOffset(start + next.length); setMore(next.length === 20);
    } catch { if (version === request.current) setError('Não foi possível carregar o feed. Se esta atualização acabou de ser instalada, aplique a migração social no Supabase.'); }
    finally { if (version === request.current) setLoading(false); }
  }, [hashtag]);
  useEffect(() => {
    setEntries([]); void load();
    let timer: ReturnType<typeof setTimeout>;
    const {data} = supabase.auth.onAuthStateChange((event,session) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      if (event === 'SIGNED_IN' && session?.user.id === account.current) return;
      request.current++; setEntries([]); setUserId(''); setViewerRole(''); setText(''); setFile(null);
      clearTimeout(timer); timer = setTimeout(() => void load(), 0);
    });
    return () => { request.current++; clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [load]);
  async function publish(event: FormEvent) {
    event.preventDefault(); if (sending.current) return;
    const invalid = publicationError(text, !!file);
    if (invalid) { setNotice(invalid); return; }
    sending.current = true; setSaving(true); setNotice('');
    let path: string | null = null;
    try {
      const auth = await supabase.auth.getUser();
      if (!auth.data.user || auth.data.user.id !== userId) throw new Error('Sua sessão mudou. Atualize a página.');
      if (file) {
        const blob = await preparePostImage(file);
        path = `${userId}/${crypto.randomUUID()}.jpg`;
        const upload = await supabase.storage.from('post-images').upload(path, blob, {contentType:'image/jpeg', upsert:false});
        if (upload.error) throw new Error('Não foi possível enviar a imagem. Confira o limite de 5 MB e a configuração do Storage.');
      }
      const result = await supabase.from('posts').insert({category_id:FEED_CATEGORY, author_id:userId, title:'', content:text.trim(), image_path:path});
      if (result.error) throw new Error('Não foi possível publicar. Confira se sua conta está ativa e tente novamente.');
      setText(''); setFile(null); if (fileInput.current) fileInput.current.value = '';
      setNotice('Publicado! Atualize o feed quando quiser ver as novas faíscas.');
    } catch (cause) {
      // Do not delete on an ambiguous insert result: the server may have committed it.
      setNotice(cause instanceof Error ? cause.message : 'Falha de conexão. Confira o feed antes de tentar novamente.');
    } finally { sending.current = false; setSaving(false); }
  }
  async function react(entry: Entry, kind: 'like' | 'ignite') {
    if (acting.current) return;
    acting.current = true; setBusy(entry.id); setNotice('');
    const selected = kind === 'like' ? entry.liked : entry.ignited;
    setAnimation(null);
    try {
      const result = selected ? await supabase.from('post_reactions').delete().eq('post_id',entry.id).eq('user_id',userId).eq('kind',kind) : await supabase.from('post_reactions').insert({post_id:entry.id,user_id:userId,kind});
      if (result.error && result.error.code !== '23505') throw result.error;
      const duplicate=result.error?.code==='23505';
      const active=!selected;
      const delta=duplicate?0:(active?1:-1);
      setEntries(current=>current.map(item=>item.id!==entry.id?item:{...item,
        likes:kind==='like'?Math.max(0,item.likes+delta):item.likes,
        ignites:kind==='ignite'?Math.max(0,item.ignites+delta):item.ignites,
        liked:kind==='like'?active:item.liked,ignited:kind==='ignite'?active:item.ignited}));
      if (!selected && !result.error) setAnimation({eventId:entry.event_id,kind,key:Date.now()});
    } catch { setNotice('Não foi possível atualizar a interação. Tente novamente.'); }
    finally { acting.current=false; setBusy(''); }
  }
  async function remove(entry: Entry) {
    if (acting.current || !window.confirm('Excluir esta faísca e seus comentários? Esta ação não pode ser desfeita.')) return;
    acting.current = true; setBusy(entry.id);
    try {
      const result = await supabase.from('posts').delete().eq('id',entry.id).eq('author_id',userId).select('id');
      if (result.error || !result.data?.length) throw new Error();
      if (entry.image_path) await supabase.storage.from('post-images').remove([entry.image_path]);
      setEntries(current=>current.filter(item=>item.id!==entry.id));
    } catch { setNotice('Não foi possível excluir. A faísca pode estar protegida pela moderação.'); }
    finally { acting.current=false; setBusy(''); }
  }
  const chooseTag = (tag: string) => { setFilter(tag); setHashtag(tag); };
  return <section aria-label="Feed da comunidade" className="mx-auto max-w-2xl">
    <header className="mb-6 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#ffd19a]">Comunidade escolar</p><h1 className="mt-2 text-3xl font-black">Ao redor da fogueira</h1></div><button onClick={() => void load()} disabled={loading} className="rounded-full border border-white/15 px-3 py-2 text-sm">Atualizar</button></header>
    {userId ? <form onSubmit={publish} className="mb-6 rounded-2xl border border-[#ff8a3d]/30 bg-white/[.035] p-4">
      <label htmlFor="publication" className="font-semibold">O que está acontecendo?</label>
      <textarea id="publication" value={text} onChange={e=>setText(e.target.value)} disabled={saving} maxLength={5000} rows={4} placeholder="Compartilhe uma ideia, uma dúvida ou um momento. Use #hashtags." className="mt-3 w-full resize-y rounded-xl bg-black/20 p-3 outline-none focus:ring-2 focus:ring-[#ff8a3d]" />
      {preview && <div className="mt-3"><img src={preview} alt="Prévia da imagem selecionada" className="max-h-64 rounded-xl"/><button type="button" disabled={saving} onClick={()=>{setFile(null);if(fileInput.current)fileInput.current.value='';}} className="mt-2 text-sm text-[#ffd19a]">Remover imagem</button></div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-white/15 px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-[#ff8a3d]">＋ Imagem<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} aria-label="Adicionar imagem" className="sr-only" onChange={e=>{const next=e.target.files?.[0]; if(next && next.size>5*1024*1024){setNotice('Use uma imagem de até 5 MB.');setFile(null);e.target.value='';return;} setFile(next || null);}} /></label><button disabled={saving} className="rounded-full bg-[#ff8a3d] px-6 py-3 font-bold text-[#21140e] disabled:opacity-50">{saving?'Publicando…':'Publicar'}</button></div>
      <p className="mt-3 text-xs text-[#b9aaa0]">{text.length}/5000 · Uma imagem JPG, PNG ou WebP, até 5 MB · Visível à comunidade</p>
    </form> : !loading && <p className="mb-6 rounded-xl border border-white/10 p-5"><Link href="/login" className="text-[#ffd19a] underline">Entre na sua conta</Link> para publicar e acompanhar o feed.</p>}
    {notice && <p role="status" className="mb-4 rounded-xl border border-white/15 p-3">{notice}</p>}
    {userId && <form onSubmit={e=>{e.preventDefault();chooseTag(filter.trim().replace(/^#/,''));}} className="mb-4 flex gap-2"><input aria-label="Filtrar por hashtag" value={filter} onChange={e=>setFilter(e.target.value)} maxLength={40} placeholder="Buscar #hashtag" className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2"/><button className="rounded-full border border-white/15 px-4 py-2">Filtrar</button>{hashtag && <button type="button" onClick={()=>chooseTag('')} className="text-[#ffd19a]">Limpar</button>}</form>}
    {error && <p role="alert" className="mb-4 text-red-200">{error}</p>}
    <div className="space-y-4">{entries.map(entry=><article key={entry.event_id} onClick={event=>{if(!(event.target as HTMLElement).closest('button,a,input,textarea,form'))setExpanded(current=>current.includes(entry.event_id)?current.filter(id=>id!==entry.event_id):[...current,entry.event_id]);}} className="cursor-pointer rounded-2xl border border-white/10 bg-white/[.035] p-4 sm:p-5">
      {entry.igniter && <p className="mb-3 text-xs text-[#ffd19a]"><ReactionIcon kind="ignite"/> <Link href={`/pessoas/${entry.igniter.id}`}>{socialHandle(entry.igniter)}</Link> deu um Ignite</p>}
      <div className="flex items-center gap-3"><Link href={`/pessoas/${entry.author_id}`} className="flex min-w-0 items-center gap-3"><Avatar author={entry.author}/><span className="break-all font-bold">{socialHandle(entry.author)}</span></Link><Link href={`/foruns/topico/${entry.id}`} className="ml-auto shrink-0 text-xs text-[#b9aaa0]" aria-label="Abrir faísca">{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'America/Sao_Paulo'}).format(new Date(entry.created_at))}</Link></div>
      {entry.title && <p className="mt-4 font-bold">{entry.title}</p>}
      <p className="mt-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.content}</p>
      {entry.image_path && <SignedPostImage path={entry.image_path}/>}
      <div className="mt-3 flex flex-wrap gap-2">{extractHashtags(entry.content).map(tag=><button key={tag} onClick={()=>chooseTag(tag)} className="text-sm text-[#ffd19a]">#{tag}</button>)}</div>
      <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-3">
        <button aria-label={`${entry.likes} curtidas`} title={`${entry.likes} curtidas`} aria-pressed={entry.liked} disabled={!!busy} onClick={()=>void react(entry,'like')} className={`inline-flex min-h-11 items-center gap-1 px-1 ${entry.liked?'text-[#ffd19a]':'text-[#b9aaa0]'}`}><span className="min-w-4 text-right text-sm font-bold">{entry.likes}</span><ReactionIcon kind="like" playKey={animation?.eventId===entry.event_id && animation.kind==="like" ? animation.key : 0}/></button>
        <button aria-label={`${entry.ignites} Ignites`} title={!entry.can_ignite?'Conteúdo restrito não pode receber Ignite':`${entry.ignites} Ignites`} aria-pressed={entry.ignited} disabled={!!busy || !entry.can_ignite} onClick={()=>void react(entry,'ignite')} className={`inline-flex min-h-11 items-center gap-1 px-1 disabled:opacity-50 ${entry.ignited?'text-[#ffd19a]':'text-[#b9aaa0]'}`}><span className="min-w-4 text-right text-sm font-bold">{entry.ignites}</span><ReactionIcon kind="ignite" playKey={animation?.eventId===entry.event_id && animation.kind==="ignite" ? animation.key : 0}/></button>
        <button type="button" aria-label={`${entry.comments} comentários`} title={`${entry.comments} comentários`} onClick={()=>setExpanded(current=>current.includes(entry.event_id)?current.filter(id=>id!==entry.event_id):[...current,entry.event_id])} className="inline-flex min-h-11 items-center gap-1 px-1 text-[#b9aaa0]"><span className="min-w-4 text-right text-sm font-bold">{entry.comments}</span><ReactionIcon kind="comment"/></button>
      </div>
      {expanded.includes(entry.event_id)&&<SparkThread postId={entry.id} userId={userId} locked={entry.is_locked} onChanged={()=>setEntries(current=>current.map(item=>item.id===entry.id?{...item,comments:item.comments+1}:item))}/>}
      {entry.author_id===userId?<button disabled={!!busy} onClick={()=>void remove(entry)} className="mt-3 text-xs text-[#b9aaa0]">Excluir faísca</button>:<ReportButton targetType="post" targetId={entry.id}/>}
      {entry.author_id!==userId&&['coordination','moderator'].includes(viewerRole)&&<StaffRemoveSpark postId={entry.id} onRemoved={()=>setEntries(current=>current.filter(item=>item.id!==entry.id))}/>}
    </article>)}</div>
    {loading && <p role="status" className="p-6 text-center text-[#b9aaa0]">Carregando feed…</p>}
    {!loading && userId && !error && !entries.length && <p className="rounded-xl border border-dashed border-white/10 p-6 text-[#b9aaa0]">{hashtag?'Nenhuma faísca com essa hashtag.':'A fogueira está acesa. Lance a primeira faísca!'}</p>}
    {more && <button disabled={loading} onClick={()=>void load(offset)} className="my-5 w-full rounded-full border border-white/15 p-3">Carregar mais</button>}
  </section>;
}
