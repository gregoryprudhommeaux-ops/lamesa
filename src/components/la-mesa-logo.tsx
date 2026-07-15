import Image from "next/image";

const SIZE_CLASS = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14 md:h-16 md:w-16",
  xl: "h-16 w-16 md:h-20 md:w-20",
} as const;

export type LaMesaLogoSize = keyof typeof SIZE_CLASS;

type LaMesaLogoProps = {
  size?: LaMesaLogoSize;
  className?: string;
  priority?: boolean;
  /** stacked (default) | monogram for compact marks */
  variant?: "stacked" | "monogram";
};

/** Transparent brush logo — use on dark surfaces (white ink). */
export function LaMesaLogo({
  size = "md",
  className = "",
  priority = false,
  variant = "stacked",
}: LaMesaLogoProps) {
  const src =
    variant === "monogram"
      ? "/brand/monogram-la-white.png"
      : "/brand/la-mesa-logo.png";

  return (
    <Image
      src={src}
      alt="LA MESA"
      width={variant === "monogram" ? 711 : 1702}
      height={variant === "monogram" ? 715 : 1868}
      priority={priority}
      className={`${SIZE_CLASS[size]} shrink-0 object-contain ${className}`.trim()}
    />
  );
}
