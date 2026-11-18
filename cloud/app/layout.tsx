import type { Metadata } from 'next';
export const metadata: Metadata = { title: '月存 MoonSave｜私人雲端版', description: '登入後，讓每月回報、草稿與儲蓄目標在自己的裝置間同步。', icons: { icon: '/app/icon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
