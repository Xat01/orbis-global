import { cn } from "@/lib/util/cn";
import type { HTMLAttributes } from "react";

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "dark";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  green: "bg-emerald-50 text-accent-2 border-emerald-200",
  amber: "bg-amber-50 text-warning border-amber-200",
  red: "bg-red-50 text-danger border-red-200",
  blue: "bg-blue-50 text-info border-blue-200",
  dark: "bg-forest text-white border-forest",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
