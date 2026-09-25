"use client";
import Link from "next/link";
import { useCallback,useEffect,useState } from "react";
import { supabase } from "@/lib/supabase";
import { socialHandle,SocialAuthor } from "@/lib/social";

type Row={id:string;username:string|null;display_name:string|null;temporary_tag:string|null;avatar_url:string|null};
export default function ProfileConnections({profileId,viewerId}:{profileId:string;viewerId:string}){
  const [following,setFollowing]=useState(false),[followers,setFollowers]=useState<Row[]>([]),[followed,setFollowed]=useState<Row[]>([]),[tab,setTab]=useState<"followers"|"following"|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const load=useCallback(async()=>{
    const [a,b,c]=await Promise.all([
      supabase.from("profile_follows").select("follower_id").eq("followed_id",profileId),
      supabase.from("profile_follows").select("followed_id").eq("follower_id",profileId),
      viewerId===profileId?Promise.resolve({data:[],error:null}):supabase.from("profile_follows").select("followed_id").eq("follower_id",viewerId).eq("followed_id",profileId),
    ]);
    if(a.error||b.error||c.error){setError("Aplique a atualização social do banco para usar seguidores.");return;}
    const ids=[...new Set([...(a.data||[]).map(x=>x.follower_id),...(b.data||[]).map(x=>x.followed_id)])];
    const profiles=ids.length?await supabase.from("profiles").select("id,username,display_name,temporary_tag,avatar_url").in("id",ids):{data:[],error:null};
    const map=new Map((profiles.data||[]).map(p=>[p.id,p as Row]));
    setFollowers((a.data||[]).map(x=>map.get(x.follower_id)).filter(Boolean) as Row[]);
    setFollowed((b.data||[]).map(x=>map.get(x.followed_id)).filter(Boolean) as Row[]);
    setFollowing(!!c.data?.length); setError("");
  },[profileId,viewerId]);
  useEffect(()=>{void load();},[load]);
  async function toggle(){setBusy(true);setError("");const result=following?await supabase.from("profile_follows").delete().eq("follower_id",viewerId).eq("followed_id",profileId):await supabase.from("profile_follows").insert({follower_id:viewerId,followed_id:profileId});setBusy(false);if(result.error)setError("Não foi possível atualizar agora.");else void load();}
  const list=tab==="followers"?followers:followed;
  return <div className="mt-6">
    <div className="flex flex-wrap gap-3">{viewerId!==profileId&&<button disabled={busy} onClick={()=>void toggle()} className={`rounded-full px-5 py-3 font-bold ${following?"border border-white/20":"bg-[#ff8a3d] text-[#21140e]"}`}>{busy?"Salvando…":following?"Deixar de seguir":"Seguir"}</button>}<button onClick={()=>setTab(tab==="followers"?null:"followers")} className="rounded-full border border-white/15 px-4 py-3">{followers.length} seguidores</button><button onClick={()=>setTab(tab==="following"?null:"following")} className="rounded-full border border-white/15 px-4 py-3">Seguindo {followed.length}</button></div>
    {error&&<p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    {tab&&<div className="mt-4 grid gap-2 rounded-xl border border-white/10 p-3">{list.length?list.map(person=><Link key={person.id} href={`/pessoas/${person.id}`} className="rounded-lg bg-white/5 p-3 font-bold">{socialHandle(person as SocialAuthor)}</Link>):<p className="p-2 text-sm text-[#b9aaa0]">Nenhuma pessoa nesta lista.</p>}</div>}
  </div>;
}
