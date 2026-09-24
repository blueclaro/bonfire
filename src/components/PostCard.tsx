import Link from "next/link";
import TopicStatus from "@/components/TopicStatus";

export default function PostCard({ name, title, meta, text, tags, href, pinned = false, locked = false }: { name: string; title: string; meta: string; text: string; tags: string[]; href: string; pinned?: boolean; locked?: boolean }) {
  return <article className="grid gap-4 rounded-xl border border-white/10 bg-white/[.045] p-4 sm:grid-cols-[44px_1fr]">
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-bold text-[#ffd19a]">{name[0]}</div>
    <div className="min-w-0"><TopicStatus pinned={pinned} locked={locked} /><h4 className="break-words font-bold"><Link href={href} className="hover:text-[#ffd19a] hover:underline">{title}</Link></h4><p className="mt-1 break-words text-sm text-[#b9aaa0]">{name} · {meta}</p><p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-[#b9aaa0]">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-xs text-[#ffd19a]">{tag}</span>)}</div>
      {href && <Link href={`${href}#novo-comentario`} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[#ff8a3d]/40 px-4 py-2 text-sm font-bold text-[#ffd19a]">{locked ? "Ver comentários" : "Comentar"}</Link>}
    </div>
  </article>;
}
