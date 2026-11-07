import Image from "next/image";

/**
 * The sloth bear from the sticker sheet, sitting and eating a roll, doing a happy little
 * dance (bob + sway, eyes-closed-chewing energy). Used on the order-confirmed screen.
 * Still when the visitor prefers reduced motion.
 */
export function HappyBear({ size = 170, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`ab-bear-stage relative inline-block ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="ab-bear-note ab-bear-note-1 absolute -top-2 right-2 font-display text-[22px] text-clay">♪</span>
      <span className="ab-bear-note ab-bear-note-2 absolute -top-4 left-4 font-display text-[18px] text-hill">♫</span>
      <Image src="/brand/stickers/bear-roll.png" alt="" width={size} height={size} className="ab-bear h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(20,20,20,0.18)]" priority />
    </div>
  );
}
