import Image from "next/image";
import Link from "next/link";

type BrandSize = "compact" | "standard" | "large";
type BrandTone = "light" | "dark";

const sizes: Record<BrandSize, { icon: number; iconClass: string; wordmarkClass: string; detailClass: string }> = {
  compact: {
    icon: 40,
    iconClass: "h-10 w-10 p-1",
    wordmarkClass: "text-sm",
    detailClass: "text-[9px]",
  },
  standard: {
    icon: 48,
    iconClass: "h-12 w-12 p-1",
    wordmarkClass: "text-base",
    detailClass: "text-[10px]",
  },
  large: {
    icon: 64,
    iconClass: "h-16 w-16 p-1.5",
    wordmarkClass: "text-xl",
    detailClass: "text-xs",
  },
};

export default function CogniaBrand({
  href,
  size = "standard",
  tone = "light",
  subtitle,
  tagline = false,
  className = "",
}: {
  href?: string;
  size?: BrandSize;
  tone?: BrandTone;
  subtitle?: string;
  tagline?: boolean;
  className?: string;
}) {
  const scale = sizes[size];
  const detail = subtitle ?? (tagline ? "EDUCATION MANAGEMENT" : null);
  const content = (
    <>
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl ${scale.iconClass} ${tone === "light" ? "bg-slate-950" : "bg-transparent"}`}>
        <Image
          src="/brand/cognia-logo.png"
          alt=""
          width={scale.icon}
          height={scale.icon}
          priority={size === "large"}
          className="h-full w-full object-contain"
        />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className={`font-extrabold leading-none tracking-[0.16em] ${scale.wordmarkClass} ${tone === "dark" ? "text-white" : "text-slate-900"}`}>
          COGNIA
        </span>
        {detail && (
          <span className={`truncate leading-none tracking-[0.12em] ${scale.detailClass} ${tone === "dark" ? "text-slate-300" : "text-slate-500"}`}>
            {detail}
          </span>
        )}
      </span>
    </>
  );
  const rootClass = `inline-flex min-w-0 items-center gap-3 ${className}`;

  return href
    ? <Link href={href} aria-label="COGNIA home" className={rootClass}>{content}</Link>
    : <div className={rootClass}>{content}</div>;
}
