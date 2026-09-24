const icons = { like: '/like.gif', comment: '/comments.png', ignite: '/ignite.gif' };

/** Keep original animation; the adjacent button text supplies the accessible name. */
export default function ReactionIcon({ kind }: { kind: keyof typeof icons }) {
  return <img src={icons[kind]} alt="" aria-hidden="true" width={32} height={32} className="inline-block h-8 w-8 shrink-0 object-contain align-middle [image-rendering:pixelated]" />;
}
