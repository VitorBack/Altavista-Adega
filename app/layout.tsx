import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/600-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Altavista | Adega & Distribuidora",
  description: "Vinhos, cervejas e outras bebidas com preços de varejo e atacado e entrega local.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
