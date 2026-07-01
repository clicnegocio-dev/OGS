import type { Metadata } from "next";
import "./globals.css";
import "./narrative.css";
import { CommandPalette } from "@/components/CommandPalette";
import { buildCommandIndex } from "@/lib/commands";

export const metadata: Metadata = {
  title: "Ecosistema Urbano — Nada está aislado",
  description:
    "Toda ciudad habla en señales. Un mapa vivo de evidencia urbana para decidir mejor dónde vivir, invertir y participar — con fuente, fecha y honestidad sobre lo que aún no se mide."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300&family=Inter+Tight:wght@600;700;800&family=Spectral:ital,wght@0,300;0,400;1,300;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CommandPalette commands={buildCommandIndex()} />
      </body>
    </html>
  );
}
