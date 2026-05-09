import Link from "next/link";

type FooterLink = {
  href: string;
  label: string;
};

type FooterLinksProps = {
  className?: string;
  items?: FooterLink[];
};

const defaultItems: FooterLink[] = [
  {
    href: "/privacy",
    label: "Privacy Policy",
  },
  {
    href: "/terms",
    label: "Terms of Service",
  },
];

export function FooterLinks({
  className = "footer-links",
  items = defaultItems,
}: FooterLinksProps) {
  return (
    <footer className={className}>
      {items.map((item) => (
        <Link className="app-link" href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </footer>
  );
}
