"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function SchoolLabelEditor({initial}:{initial:string}) {
  const [label,setLabel]=useState(initial), [saved,setSaved]=useState(initial);
  const [editing,setEditing]=useState(false), [busy,setBusy]=useState(false), [message,setMessage]=useState('');
  return <div className="mt-3 text-sm"><span className="inline-flex items-center gap-1 rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-[#ffd19a]">🏷️ {saved || 'Turma não informada'}</span><button onClick={()=>{setEditing(!editing);setMessage('');setLabel(saved);}} className="ml-3 min-h-11 underline">{editing?'Cancelar':'Editar turma'}</button>
    {editing && <form className="mt-3 max-w-md" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{const result=await supabase.rpc('set_school_label',{label:label.trim()});if(result.error)throw result.error;setSaved(label.trim());setEditing(false);}catch{setMessage('Não foi possível salvar a turma. Use no máximo 5 letras ou números e confira se a migração foi aplicada.');}finally{setBusy(false);}}}><label>Etiqueta de turma<input pattern="[A-Za-z0-9]{0,5}" maxLength={5} autoCapitalize="characters" value={label} onChange={e=>setLabel(e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,5))} placeholder="Ex.: IA24" className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3"/></label><p className="mt-2 text-xs text-[#b9aaa0]">Até 5 letras ou números, sem espaços ou símbolos. Informação do perfil; não altera permissões de acesso a turmas.</p><button disabled={busy} className="mt-3 rounded-full bg-[#ff8a3d] px-4 py-2 font-bold text-[#21140e]">{busy?'Salvando…':'Salvar turma'}</button></form>}
    {message && <p role="alert" className="mt-2 text-red-200">{message}</p>}
  </div>;
}
