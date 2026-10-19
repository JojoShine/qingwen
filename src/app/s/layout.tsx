import type { Viewport } from 'next';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, minimumScale: 1, maximumScale: 1, userScalable: false };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
