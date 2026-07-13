type ChatMessageProps = {
  name: string;
  text: string;
  mine?: boolean;
  compact?: boolean;
};

export default function ChatMessage({
  name,
  text,
  mine = false,
  compact = false,
}: ChatMessageProps) {
  return (
    <div className={compact ? "" : `flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-3 text-sm ${
          compact ? "max-w-[86%]" : "max-w-[85%] md:max-w-[70%]"
        } ${
          mine
            ? `${compact ? "ml-auto" : ""} bg-[#ff8a3d] font-semibold text-[#21140e]`
            : "bg-white/10 text-[#f6efe7]"
        }`}
      >
        <strong className="mb-1 block text-xs opacity-70">{name}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}