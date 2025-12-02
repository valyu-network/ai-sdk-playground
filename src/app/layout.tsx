import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Valyu AI SDK Playground",
  description: "AI SDK Playground for @valyu/ai-sdk tools",
  metadataBase: new URL("https://ai-sdk.valyu.ai"),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Valyu AI SDK Playground",
    description: "AI SDK Playground for @valyu/ai-sdk tools",
    url: "https://ai-sdk.valyu.ai",
    siteName: "Valyu AI SDK Playground",
    images: [
      {
        url: "/valyu-aisdk.png",
        width: 1200,
        height: 630,
        alt: "Valyu AI SDK Playground",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Valyu AI SDK Playground",
    description: "AI SDK Playground for @valyu/ai-sdk tools",
    images: ["/valyu-aisdk.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
