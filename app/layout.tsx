import type { Metadata } from "next";
import "./globals.css";
import Nav from "./_components/Nav";
import Footer from "./_components/Footer";
import AutoEmailCaptureModal from "./_components/AutoEmailCaptureModal";

export const metadata: Metadata = {
  title: "Aura Wellness Aesthetics — Amy",
  description: "Bohemian, serene skincare studio by Amy in Fort Lauderdale, FL. Customized facials, brows, and gentle advanced treatments. Servicing all of South Florida.",
  openGraph: {
    title: "Aura Wellness Aesthetics — Amy",
    description: "Bohemian, serene skincare studio by Amy. Customized facials, brows, and gentle advanced treatments in Fort Lauderdale, FL.",
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
        <Nav />
        <main id="main-content">
          {children}
        </main>
        <Footer />
        <AutoEmailCaptureModal />
      </body>
    </html>
  );
}

