import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import Providers from '@/components/providers';
import './globals.css';
import './ui-refinement.css';
const geist = localFont({ src: './fonts/Geist-Variable.woff2', variable: '--font-geist', weight: '100 900', display: 'swap', adjustFontFallback: false });
export const metadata: Metadata = { title: { default: '轻问 · 让每一份回答都有价值', template: '%s · 轻问' }, description: '简洁好用的问卷工作台，轻松创建、分享和分析你的问卷。', robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="zh-CN" className={geist.variable}><body><AntdRegistry><Providers>{children}</Providers></AntdRegistry></body></html>; }
