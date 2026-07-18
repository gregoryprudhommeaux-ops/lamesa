import { laMesaDisplayFallback } from "@/lib/fonts/la-mesa-display";
import { Providers } from "@/components/providers";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LA MESA",
    template: "%s · LA MESA",
  },
  description: "Administration LA MESA · Guadalajara.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/icon", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
};

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const messages = (await import("../../../messages/fr.json")).default;

  return (
    <html lang="fr" className={`${inter.variable} ${laMesaDisplayFallback.variable} h-full`}>
      <body className="min-h-full font-sans antialiased">
        <NextIntlClientProvider locale="fr" messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
