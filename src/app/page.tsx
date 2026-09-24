import Sidebar from '@/components/Sidebar';
import SocialFeed from '@/components/SocialFeed';
import Link from 'next/link';
import RecentNotices from '@/components/RecentNotices';
export default function Home() {
  return <main className="min-h-screen bg-[#11100f] text-[#f6efe7]"><div className="app-shell grid min-h-screen xl:grid-cols-[260px_minmax(0,1fr)_280px]">
    <Sidebar active="inicio" showRooms={false}/>
    <div className="min-w-0 p-4 md:p-8"><SocialFeed/></div>
    <aside className="hidden border-l border-white/10 p-6 xl:block"><h2 className="text-xl font-bold">Seu Bonfire</h2><p className="mt-3 text-sm leading-6 text-[#b9aaa0]">Ideias, dúvidas e momentos da comunidade. Use hashtags para encontrar conversas.</p><Link href="/mensagens" className="mt-6 block rounded-xl border border-white/15 p-4 text-[#ffd19a]">Mensagens individuais →</Link><Link href="/chats" className="mt-3 block rounded-xl border border-white/15 p-4">Salas da comunidade →</Link><div className="mt-8"><RecentNotices/></div></aside>
  </div></main>;
}
