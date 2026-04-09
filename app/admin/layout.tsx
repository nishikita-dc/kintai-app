import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '勤怠管理ダッシュボード',
  description: 'スター歯科クリニック 勤怠管理ダッシュボード',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
