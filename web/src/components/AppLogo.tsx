import Image from "next/image";
import Link from "next/link";

type AppLogoProps = {
  ariaLabel?: string;
  href?: string;
  linkClassName?: string;
  priority?: boolean;
  size: "large" | "small";
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppLogo({
  ariaLabel = "ClearTrend",
  href,
  linkClassName = "block",
  priority = true,
  size,
}: AppLogoProps) {
  const logo = (
    <picture>
      <source
        media="(prefers-color-scheme: light)"
        srcSet="/logo-draft67.png"
      />
      <Image
        alt="ClearTrend"
        className={cx(
          size === "large" ? "brand-logo-large mx-auto" : "brand-logo-small"
        )}
        height={size === "large" ? 280 : 90}
        priority={priority}
        src="/logo-draft10.png"
        width={size === "large" ? 500 : 120}
      />
    </picture>
  );

  if (!href) {
    return logo;
  }

  return (
    <Link aria-label={ariaLabel} className={linkClassName} href={href}>
      {logo}
    </Link>
  );
}
