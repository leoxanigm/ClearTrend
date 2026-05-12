import Link from "next/link";
import { useTranslations } from "next-intl";

type FooterLink = {
  href: string;
  label: string;
};

type FooterLinksProps = {
  className?: string;
  items?: FooterLink[];
};

export function FooterLinks({
  className = "footer-links",
  items,
}: FooterLinksProps) {
  const t = useTranslations("footer");
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
