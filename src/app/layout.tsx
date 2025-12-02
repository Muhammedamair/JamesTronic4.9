import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Viewport } from "next";
import "./globals.css";
import SupabaseProvider from "@/components/shared/supabase-provider";
import ReactQueryProvider from "@/components/shared/react-query-provider";
import OneSignalInitializer from "@/components/shared/OneSignalInitializer";
import { CustomerProvider } from "@/components/customer/customer-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JamesTronic",
  description: "Electronic Repair Service Management",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="JamesTronic" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/vercel.svg" />


        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <SupabaseProvider>
            <CustomerProvider>
              <OneSignalInitializer />
              {children}
            </CustomerProvider>
          </SupabaseProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
