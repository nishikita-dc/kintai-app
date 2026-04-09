import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '勤怠管理ダッシュボード',
  description: 'スター歯科クリニック 勤怠管理ダッシュボード',
  openGraph: {
    title: '勤怠管理ダッシュボード',
    description: 'スター歯科クリニック 勤怠管理ダッシュボード',
    images: [{ url: '/og-dashboard.png', width: 1200, height: 630 }],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
