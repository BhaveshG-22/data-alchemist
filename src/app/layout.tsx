import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Data Alchemist - CSV/XLSX Validation & Rule Management",
  description: "Comprehensive data validation and management application for CSV/XLSX files with AI-powered features, business rule management, and advanced validation system for clients, workers, and tasks data.",
  keywords: [
    "data validation",
    "CSV processing",
    "XLSX processing", 
    "business rules",
    "data management",
    "AI-powered validation",
    "natural language search",
    "data modification",
    "rule engine",
    "prioritization system"
  ],
  authors: [{ name: "Data Alchemist Team" }],
  creator: "Data Alchemist Assignment Project",
  publisher: "Data Alchemist",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Data Alchemist - Advanced Data Validation System",
    description: "Transform your CSV/XLSX data with intelligent validation, AI-powered corrections, and comprehensive business rule management.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Data Alchemist - CSV/XLSX Validation Tool",
    description: "Advanced data validation system with AI features and rule management for enterprise data processing.",
  },
  verification: {
    google: "data-alchemist-validation-system",
  },
  category: "Data Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
