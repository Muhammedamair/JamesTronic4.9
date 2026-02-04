import type { ReactNode } from 'react';
import { CustomerProvider } from '@/components/customer/customer-provider';
import PublicRootLayout from './PublicRootLayout';

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CustomerProvider>
      <PublicRootLayout>{children}</PublicRootLayout>
    </CustomerProvider>
  );
}