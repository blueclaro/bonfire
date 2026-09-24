/** Serve the original GIF directly so its animation is preserved. */
export default function BonfireLogo({ large = false }: { large?: boolean }) {
  return <img src="/bonfire.gif" alt="" aria-hidden="true" width={large ? 72 : 48} height={large ? 72 : 48} className={`${large ? "mx-auto h-[72px] w-[72px]" : "h-12 w-12"} shrink-0 object-contain [image-rendering:pixelated]`} />;
}
