import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flavourly OS — Turn walk-ins into regulars",
  description:
    "WhatsApp-native customer retention & loyalty operating system for Southern African SMEs. Fill your empty chairs.",
  keywords: ["Flavourly", "WhatsApp loyalty", "South Africa", "SME", "retention", "stamps", "points"],
  authors: [{ name: "Flavourly" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Flavourly OS",
    description: "Fill your empty chairs. Turn walk-ins into regulars.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6B00",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
