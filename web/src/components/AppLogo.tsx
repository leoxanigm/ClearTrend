import Image from "next/image";
import Link from "next/link";
import { cx } from "@/components/ui/cx";

// Theme-aware ClearTrend logo, optionally wrapped in an application link.
type AppLogoProps = {
  ariaLabel?: string;
  href?: string;
  linkClassName?: string;
  priority?: boolean;
  size: "large" | "small";
};

// Both theme variants remain in the DOM so CSS can switch without a React render.
export function AppLogo({
  ariaLabel = "ClearTrend",
  href,
  linkClassName = "block",
  priority = true,
  size,
}: AppLogoProps) {
  // CSS displays only the image matching the active light or dark theme.
  const logo = (
    <span aria-label="ClearTrend" className="app-logo" role="img">
      <Image
        alt="ClearTrend"
        aria-hidden="true"
        className={cx(
          "app-logo-image-light",
          size === "large" ? "brand-logo-large mx-auto" : "brand-logo-small"
        )}
        // Explicit dimensions reserve layout space before the bitmap loads.
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
    // The logo can remain decorative when no navigation target is required.
    return logo;
  }

  return (
    // The link receives the navigation label while inner images stay decorative.
    <Link aria-label={ariaLabel} className={linkClassName} href={href}>
      {logo}
    </Link>
  );
}
