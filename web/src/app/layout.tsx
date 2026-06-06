import type { Metadata } from "next";
import "./globals.css";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import Script from "next/script";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <Script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          id="theme-init"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
