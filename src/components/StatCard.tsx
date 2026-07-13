type StatCardProps = {
  label: string;
  value: string;
};

export default function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="flex items-end justify-between border-b border-white/10 py-4">
      <span className="text-sm text-[#b9aaa0]">{label}</span>
      <strong className="text-3xl">{value}</strong>
    </div>
  );
}