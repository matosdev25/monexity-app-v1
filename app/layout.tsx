import type { Metadata } from "next";
import "./globals.css";
import { AppToaster } from "../components/app-toaster";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "Monexity | Negocios",
    template: "%s | Monexity",
  },
  description: "Sistema de ventas, gastos y control para pequeños negocios.",
  icons: {
    icon: [
      {
        url: "/favicon-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          {children}
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
