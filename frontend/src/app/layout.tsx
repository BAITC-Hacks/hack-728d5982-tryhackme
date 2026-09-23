import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ЭКТ — помощник покупателя",
  description: "Подбор электротехники, характеристики и наличие в одном чате.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
