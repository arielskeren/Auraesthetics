import type { Metadata } from "next";
import "./globals.css";
import ConditionalLayout from "./_components/ConditionalLayout";
import ClientLayout from "./ClientLayout";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "Aura Wellness Aesthetics — Amy",
  description: "Wellness to your aura skincare studio by Amy in Fort Lauderdale, FL. Customized facials, brows, and gentle advanced treatments. Servicing all of South Florida.",
  openGraph: {
    title: "Aura Wellness Aesthetics — Amy",
    description: "Wellness to your aura skincare studio by Amy. Customized facials, brows, and gentle advanced treatments in Fort Lauderdale, FL.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
        <ClientLayout />
        <Analytics />
      </body>
    </html>
  );
}

