import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Keeper — Returns Rescue",
  description:
    "Keeper turns size-driven refunds into kept sales. Deterministic decisions, an agent swarm, and a live rescue ledger.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
