import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { getLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes the opengraph-image URL absolute (required for WhatsApp/social previews).
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Hairstyling Paradiso | Friseur in München-Maxvorstadt",
    template: "%s · Hairstyling Paradiso",
  },
  description:
    "Friseur für Damen und Herren in der Augustenstraße 72 in München, mit Studentenrabatt. Termine kannst du online buchen.",
  openGraph: {
    title: "Hairstyling Paradiso | Friseur in München-Maxvorstadt",
    description: "Friseur für Damen und Herren in der Augustenstraße 72. Termine online buchen.",
    locale: "de_DE",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
