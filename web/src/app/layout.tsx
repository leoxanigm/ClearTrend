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
  // Resolve the active locale selected by request.ts: cookie, browser, then English.
  const locale = await getLocale();
  // Retrieve the JSON dictionary already loaded for this locale.
  const messages = await getMessages();

  return (
    // Expose the active language to browsers and assistive technologies.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <Script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
          id="theme-init"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        {/* Make the dictionary available to every client component below. */}
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
