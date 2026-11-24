import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COGNIA | Education Management",
  applicationName: "COGNIA",
  description: "COGNIA is an education management platform for institutions at every level.",
  icons: {
    icon: "/brand/cognia-logo.png",
    apple: "/brand/cognia-logo.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
