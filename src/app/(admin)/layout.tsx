import type { ReactNode } from 'react';
import { CustomerProvider } from '@/components/customer/customer-provider';
import AdminRootLayout from './AdminRootLayout';

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CustomerProvider>
      <AdminRootLayout>{children}</AdminRootLayout>
    </CustomerProvider>
  );
}