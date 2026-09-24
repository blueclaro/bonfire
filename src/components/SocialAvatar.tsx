import {SocialAuthor} from '@/lib/social';
export default function SocialAvatar({author}:{author:SocialAuthor|null}) {
  return author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer"/> : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ff8a3d]/20 font-bold text-[#ffd19a]">{(author?.display_name||author?.username||'B').charAt(0).toUpperCase()}</span>;
}
