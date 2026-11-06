import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis Protocol',
  description:
    'Bilateral DvP repo and two-tranche trade credit on Stellar Soroban, with on-chain compliance gating. Live on testnet.',
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
