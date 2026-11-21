import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COGNIA | Education Management",
  description: "COGNIA is an education management platform for institutions at every level.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
