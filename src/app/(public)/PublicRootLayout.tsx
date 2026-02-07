import type { ReactNode } from 'react';
import { Header } from '@/components/ui/header';

export default function PublicRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
    </>
  );
}