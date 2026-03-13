import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '나노바나나2',
  description: 'Google Nano Banana 2 (Gemini 3.1 Flash Image) via Replicate',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
