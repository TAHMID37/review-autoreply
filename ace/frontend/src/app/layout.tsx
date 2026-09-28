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
  title: `Review Auto-Reply - ${APP_BRAND.displayName}`,
  description: `Google review inbox and auto-reply dashboard for ${APP_BRAND.displayName}.`,
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
