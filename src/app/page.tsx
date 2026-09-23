import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import RecentTopics from "@/components/RecentTopics";
import HomeChat from "@/components/HomeChat";
import TodayStats from "@/components/TodayStats";
import RecentNotices from "@/components/RecentNotices";
import HomeProfile from "@/components/HomeProfile";
import TopicSearch from "@/components/TopicSearch";

export default function Home() {
  return <main className="min-h-screen bg-[#11100f] text-[#f6efe7]"><section className="grid min-h-screen grid-cols-1 xl:grid-cols-[260px_1fr_340px]">
    <Sidebar active="inicio" />
    <section className="p-4 md:p-6">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><TopicSearch /><HomeProfile /></header>
      <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-br from-[#21140e] to-[#15110f] p-6 shadow-2xl md:p-8"><p className="mb-3 text-sm font-bold uppercase tracking-[.2em] text-[#ffd19a]">PPO 2026</p><h2 className="max-w-3xl text-4xl font-black leading-none md:text-6xl">As conversas do colégio em um só lugar.</h2><p className="mt-5 max-w-2xl text-[#b9aaa0]">Fóruns para dúvidas, chats por turma e avisos organizados para os alunos se ajudarem sem perder nada.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/foruns" className="rounded-full bg-[#ff8a3d] px-5 py-3 text-center font-bold text-[#21140e]">Criar tópico</Link><Link href="/chats" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-center font-bold">Entrar em uma sala</Link></div></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]"><RecentTopics /><aside className="border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"><TodayStats /><RecentNotices /></aside></div>
    </section>
    <HomeChat />
  </section></main>;
}
