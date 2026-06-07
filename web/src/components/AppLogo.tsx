import Image from "next/image";
import Link from "next/link";
import { cx } from "@/components/ui/cx";

type AppLogoProps = {
  ariaLabel?: string;
  href?: string;
  linkClassName?: string;
  priority?: boolean;
  size: "large" | "small";
};

export function AppLogo({
  ariaLabel = "ClearTrend",
  href,
  linkClassName = "block",
  priority = true,
  size,
}: AppLogoProps) {
  const logo = (
    <span aria-label="ClearTrend" className="app-logo" role="img">
      <Image
        alt="ClearTrend"
        aria-hidden="true"
        className={cx(
          "app-logo-image-light",
          size === "large" ? "brand-logo-large mx-auto" : "brand-logo-small"
        )}
        height={size === "large" ? 280 : 90}
        priority={priority}
        src="/logo-draft67.png"
        width={size === "large" ? 500 : 120}
      />
      <Image
        alt="ClearTrend"
        aria-hidden="true"
        className={cx(
          "app-logo-image-dark",
          size === "large" ? "brand-logo-large mx-auto" : "brand-logo-small"
        )}
        height={size === "large" ? 280 : 90}
        priority={priority}
        src="/logo-draft10.png"
        width={size === "large" ? 500 : 120}
      />
    </span>
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
