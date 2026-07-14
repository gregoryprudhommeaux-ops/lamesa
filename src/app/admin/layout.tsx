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
    default: "LA MESA Secreta",
    template: "%s · LA MESA Secreta",
  },
  description: "Administration LA MESA Secreta — cenas privadas exclusivas en Guadalajara.",
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
