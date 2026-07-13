import type { ReactNode } from "react";

export type NsMarkSize = "sm" | "md" | "lg";

export type NsMarkProps = {
  size?: NsMarkSize;
  className?: string;
  /** Override inner label (default: NS). */
  children?: ReactNode;
};

const SIZE_CLASS: Record<NsMarkSize, string> = {
  sm: "h-8 w-8 rounded-md text-xs",
  md: "h-10 w-10 rounded-lg text-sm",
  lg: "h-12 w-12 rounded-lg text-base",
};

/** NextStep Services mark — shared across NS Suite products. */
export function NsMark({ size = "md", className = "", children = "NS" }: NsMarkProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-ns-primary font-black text-black ${SIZE_CLASS[size]} ${className}`}
      aria-hidden
    >
      {children}
    </div>
  );
}
