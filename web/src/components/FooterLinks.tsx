import Link from "next/link";
import { useTranslations } from "next-intl";

// Shared legal footer with translated defaults and optional custom links.
type FooterLink = {
  href: string;
  label: string;
};

type FooterLinksProps = {
  className?: string;
  items?: FooterLink[];
};

// Supplying items replaces the translated privacy/terms defaults.
export function FooterLinks({
  className = "footer-links",
  items,
}: FooterLinksProps) {
  const t = useTranslations("footer");
  // Resolve defaults during render so they follow the active locale.
  const resolvedItems = items ?? [
    {
      href: "/privacy",
      label: t("privacy"),
    },
    {
      href: "/terms",
      label: t("terms"),
    },
  ];

  return (
    <footer className={className}>
      {resolvedItems.map((item) => (
        <Link className="app-link" href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </footer>
  );
}
