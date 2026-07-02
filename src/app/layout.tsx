import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { getLocale } from "@/lib/locale";
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
  title: {
    default: "Hairstyling Paradiso — Friseur in München (Maxvorstadt)",
    template: "%s · Hairstyling Paradiso",
  },
  description:
    "Hairstyling Paradiso in der Augustenstraße 72, München-Maxvorstadt: Damen- und Herrenfriseur mit Studentenrabatt. Termin einfach online buchen.",
  openGraph: {
    title: "Hairstyling Paradiso — Friseur in München (Maxvorstadt)",
    description:
      "Damen- und Herrenfriseur in der Augustenstraße 72 — Termin einfach online buchen.",
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
