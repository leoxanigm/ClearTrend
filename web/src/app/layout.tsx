import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

const themeInitScript = `
try {
  const theme = location.pathname === "/login"
    ? null
    : localStorage.getItem("cleartrend-theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
  }
} catch {}
`;

export const metadata: Metadata = {
  title: "ClearTrend",
  description: "Market trend dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
