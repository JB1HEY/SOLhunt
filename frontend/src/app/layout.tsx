import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { WalletContextProvider } from '@/components/WalletContextProvider';
import Navbar from '@/components/Navbar';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SOLhunt - Decentralized Freelance Platform',
  description: 'Post and complete bounties on Solana',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={outfit.className}>
        <WalletContextProvider>
          <Navbar />
          <main className="min-h-screen bg-background">
            {children}
          </main>
        </WalletContextProvider>
      </body>
    </html>
  );
}