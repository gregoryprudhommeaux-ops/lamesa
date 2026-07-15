import Image from "next/image";

const SIZE_CLASS = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

type LaMesaMarkProps = {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  priority?: boolean;
};

/** Lime square + brush « LA » — replaces NsMark in LA MESA UI / favicon twin. */
export function LaMesaMark({
  size = "md",
  className = "",
  priority = false,
}: LaMesaMarkProps) {
  return (
    <Image
      src="/brand/la-mesa-mark-green.png"
      alt=""
      width={128}
      height={128}
      priority={priority}
      aria-hidden
      className={`${SIZE_CLASS[size]} shrink-0 rounded-md object-cover ${className}`.trim()}
    />
  );
}
