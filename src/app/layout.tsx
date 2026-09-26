import type {Metadata} from 'next';
import {Noto_Sans, Noto_Sans_Telugu, Noto_Sans_Devanagari} from 'next/font/google';
import './globals.css';

const notoSans = Noto_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-telugu',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-devanagari',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'MediBridge — Your medical records, in your language',
  description: 'Privately store your medical records, understand your reports, and prepare for appointments — in English, Telugu, or Hindi.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${notoSans.variable} ${notoSansTelugu.variable} ${notoSansDevanagari.variable}`}>
        {children}
      </body>
    </html>
  );
}
