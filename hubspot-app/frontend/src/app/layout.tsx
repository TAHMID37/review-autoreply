import type { Metadata } from "next";
import { Raleway } from "next/font/google";
import { APP_BRAND } from "@/lib/app-brand";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-raleway",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_BRAND.displayName,
  description: "Google review auto-replies, saved under your HubSpot contacts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={raleway.variable}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
