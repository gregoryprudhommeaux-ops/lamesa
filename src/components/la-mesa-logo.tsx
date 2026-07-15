import Image from "next/image";

type LogoVariant = "stacked" | "monogram" | "horizontal";
type LogoTone = "white" | "black" | "lime";

const SIZE_CLASS: Record<
  LogoVariant,
  Record<"sm" | "md" | "lg" | "xl", string>
> = {
  stacked: {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14 md:h-16 md:w-16",
    xl: "h-16 w-16 md:h-20 md:w-20",
  },
  monogram: {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14 md:h-16 md:w-16",
    xl: "h-16 w-16 md:h-20 md:w-20",
  },
  horizontal: {
    sm: "h-6 w-auto",
    md: "h-8 w-auto",
    lg: "h-10 w-auto md:h-11",
    xl: "h-11 w-auto md:h-14",
  },
};

const SRC: Record<LogoVariant, Record<LogoTone, string>> = {
  stacked: {
    white: "/brand/stacked-white.png",
    black: "/brand/stacked-black.png",
    lime: "/brand/stacked-lime.png",
  },
  monogram: {
    white: "/brand/monogram-la-white.png",
    black: "/brand/monogram-la-black.png",
    lime: "/brand/monogram-la-lime.png",
  },
  horizontal: {
    white: "/brand/wordmark-horizontal-white.png",
    black: "/brand/wordmark-horizontal-black.png",
    // no horizontal lime asset — fall back to white
    lime: "/brand/wordmark-horizontal-white.png",
  },
};

const INTRINSIC: Record<LogoVariant, { width: number; height: number }> = {
  stacked: { width: 1702, height: 1868 },
  monogram: { width: 711, height: 715 },
  horizontal: { width: 1870, height: 613 },
};

export type LaMesaLogoSize = "sm" | "md" | "lg" | "xl";

type LaMesaLogoProps = {
  size?: LaMesaLogoSize;
  className?: string;
  priority?: boolean;
  variant?: LogoVariant;
  /** white on dark (default); black on light cards */
  tone?: LogoTone;
};

/** Brush logo — pick tone for the surface behind it. */
export function LaMesaLogo({
  size = "md",
  className = "",
  priority = false,
  variant = "horizontal",
  tone = "white",
}: LaMesaLogoProps) {
  const { width, height } = INTRINSIC[variant];

  return (
    <Image
      src={SRC[variant][tone]}
      alt="LA MESA"
      width={width}
      height={height}
      priority={priority}
      className={`${SIZE_CLASS[variant][size]} shrink-0 object-contain ${className}`.trim()}
    />
  );
}
