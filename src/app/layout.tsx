import type { Metadata } from "next";
import { Inter, Inter_Tight, Spectral } from "next/font/google";
import "./globals.css";
import "./narrative.css";
import { CommandPalette } from "@/components/CommandPalette";
import { buildCommandIndex } from "@/lib/commands";

// Fuentes self-hosted por next/font (antes: <link> a Google Fonts, render-blocking y con fuga de IP
// del visitante a Google — contra el principio de privacidad del proyecto). Exponen variables CSS que
// globals.css consume vía --sans/--display/--serif.
const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap"
});
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap"
});
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Ecosistema Urbano — Nada está aislado",
  description:
    "Toda ciudad habla en señales. Un mapa vivo de evidencia urbana para decidir mejor dónde vivir, invertir y participar — con fuente, fecha y honestidad sobre lo que aún no se mide."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" className={`${inter.variable} ${interTight.variable} ${spectral.variable}`}>
      <body>
        {children}
        <CommandPalette commands={buildCommandIndex()} />
      </body>
    </html>
  );
}
