import Link from "next/link";

export default function NoticePreview({ title, text, href, createdAt }: {
  title: string; text: string; href: string; createdAt: string;
}) {
  return <article className="border-b border-white/10 py-4">
    <Link href={href} className="block break-words font-bold hover:text-[#ffd19a] hover:underline">{title}</Link>
    <time dateTime={createdAt} className="mt-1 block text-xs text-[#b9aaa0]">
      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(createdAt))}
    </time>
    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm text-[#b9aaa0]">{text}</p>
  </article>;
}
