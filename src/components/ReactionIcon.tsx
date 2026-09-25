"use client";
import { useEffect, useRef, useState } from 'react';
const icons = { like: '/like-still.png', comment: '/comments.png', ignite: '/ignite-still.png' };

/** One cycle (16 frames × 130 ms), only after an explicitly requested reaction. */
export default function ReactionIcon({ kind, playKey = 0 }: { kind: keyof typeof icons; playKey?: number }) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    setPlaying(kind !== 'comment' && playKey > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return () => clearTimeout(timer.current);
  }, [kind, playKey]);
  return <img key={playing ? playKey : 'still'} src={playing ? `/${kind}.gif?play=${playKey}` : icons[kind]} alt="" aria-hidden="true" width={32} height={32}
    onLoad={() => { if (playing) { clearTimeout(timer.current); timer.current = setTimeout(() => setPlaying(false), 2080); } }}
    onError={() => { clearTimeout(timer.current); setPlaying(false); }}
    className="inline-block h-8 w-8 shrink-0 object-contain align-middle [image-rendering:pixelated]" />;
}
