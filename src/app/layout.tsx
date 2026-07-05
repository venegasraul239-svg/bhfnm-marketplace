import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AgeGate } from "@/components/AgeGate";
import { JsonLd } from "@/components/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/schema-org";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL("https://buyhempflowernearme.com"),
  title: {
    default: "BHFNM Marketplace — Verified Hemp, Batch-Linked COAs, Bitcoin Checkout",
    template: "%s | BHFNM Marketplace",
  },
  description:
    "A compliance-first hemp marketplace: identity-verified sellers, admin-verified batch COAs, tracked marketplace shipping, and Bitcoin & Lightning checkout.",
  openGraph: {
    siteName: "BHFNM Marketplace",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${inter.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply stored theme before paint; light is the default. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('bhfnm-theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <AgeGate />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
