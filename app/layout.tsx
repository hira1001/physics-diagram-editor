import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "力学図エディタ",
  description: "変量と制約を理解する、IDE/CAD品質の物理図エディタ。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
