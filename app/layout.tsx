import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'スター歯科クリニック 勤怠管理アプリ',
  description: '勤怠打刻データ作成ツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-slate-50 text-slate-700 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
