type PostCardProps = {
  name: string;
  title: string;
  meta: string;
  text: string;
  tags: string[];
};

export default function PostCard({
  name,
  title,
  meta,
  text,
  tags,
}: PostCardProps) {
  return (
    <article className="grid grid-cols-1 gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-4 sm:grid-cols-[44px_1fr]">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 font-bold text-[#ffd19a]">
        {name[0]}
      </div>

      <div>
        <h4 className="font-bold">{title}</h4>

        <p className="mt-1 text-sm text-[#7d7068]">
          {name} · {meta}
        </p>

        <p className="mt-3 text-[#b9aaa0]">{text}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#ff8a3d]/10 px-3 py-1 text-xs text-[#ffd19a]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}