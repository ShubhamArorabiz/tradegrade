import { HardHat } from "lucide-react";

export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-[10px] bg-brand text-white"
        style={{ width: size, height: size }}
      >
        <HardHat size={size * 0.56} strokeWidth={2.4} />
      </span>
      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">TradeGrade</span>
    </span>
  );
}
