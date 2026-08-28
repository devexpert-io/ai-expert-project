import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Estudio — esenciales cotidianos",
  description: "Una colección editada de prendas para todos los días.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link className="site-wordmark" href="/" aria-label="Estudio, inicio">
            Estudio
          </Link>
          <nav aria-label="Navegación principal" className="site-navigation">
            <Link href="/">Nueva temporada</Link>
            <Link href="/?category=camisetas#catalog-results">Camisetas</Link>
            <Link href="/?category=pantalones#catalog-results">Pantalones</Link>
            <Link href="/#catalog-results">Colección</Link>
          </nav>
          <nav aria-label="Atajos del catálogo" className="site-utilities">
            <Link href="/#catalog-filters-title">Filtrar</Link>
            <Link href="/#catalog-results">Edición 01</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
