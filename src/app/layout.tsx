import type { Metadata } from "next";
import "./globals.css"; // Importação crucial

export const metadata: Metadata = {
  title: "Dashboard Financeira AGF",
  description: "Gerado por Manus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
