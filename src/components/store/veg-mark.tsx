/** FSSAI-style veg / non-veg mark: green dot in a square, or red triangle. */
export function VegMark({ veg, className = "" }: { veg: boolean; className?: string }) {
  return (
    <span
      aria-label={veg ? "Veg" : "Non-veg"}
      role="img"
      className={`flex h-3 w-3 flex-none items-center justify-center border-[1.5px] ${veg ? "border-veg" : "border-nonveg"} ${className}`}
    >
      {veg ? (
        <span className="h-1.5 w-1.5 rounded-full bg-veg" />
      ) : (
        <span className="h-0 w-0 border-x-4 border-b-[7px] border-x-transparent border-b-nonveg" />
      )}
    </span>
  );
}
