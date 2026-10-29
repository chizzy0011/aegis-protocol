import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis Protocol | Institutional DvP Repo & Structured Credit',
  description:
    'Institutional Collateral Clearing, Bilateral DvP Repo, and Emerging Market Structured Credit on Stellar Soroban',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-aegis-dark text-slate-100 selection:bg-aegis-gold selection:text-black">
        {children}
      </body>
    </html>
  );
}
