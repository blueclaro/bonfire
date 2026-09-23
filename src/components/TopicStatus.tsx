export default function TopicStatus({ pinned, locked }: { pinned: boolean; locked: boolean }) {
  if (!pinned && !locked) return null;
  return <div className="mb-3 flex flex-wrap gap-2 text-xs">
    {pinned && <span className="rounded-full border border-[#ff8a3d]/30 bg-[#ff8a3d]/10 px-3 py-1 text-[#ffd19a]">Fixado</span>}
    {locked && <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[#b9aaa0]">Fechado para respostas</span>}
  </div>;
}
