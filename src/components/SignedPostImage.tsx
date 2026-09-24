"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SignedPostImage({ path }: { path: string }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setUrl(''); setError(false);
    void supabase.storage.from('post-images').createSignedUrl(path, 120).then(({data, error}) => {
      if (live) { setUrl(data?.signedUrl || ''); setError(!!error); }
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [path, retry]);
  return <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
    {error ? <button type="button" onClick={() => setRetry(n => n+1)} className="p-4 text-sm text-[#ffd19a]">Imagem indisponível. Tentar novamente</button> : url ? <img src={url} alt="Imagem anexada à publicação" loading="lazy" onError={() => setError(true)} className="max-h-[560px] w-full object-contain" /> : <p className="p-4 text-sm text-[#b9aaa0]">Carregando imagem…</p>}
  </div>;
}
