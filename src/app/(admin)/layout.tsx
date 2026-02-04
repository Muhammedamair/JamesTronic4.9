import type { ReactNode } from 'react';
import { CustomerProvider } from '@/components/customer/customer-provider';
import AdminRootLayout from './AdminRootLayout';
import { SessionProvider } from '@/lib/auth-system/sessionHooks';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { cookies } from 'next/headers';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Fetch session server-side
  const cookieStore = await cookies();
  const { valid, session } = await SessionManager.validateSession(cookieStore);

  return (
    <SessionProvider initialSession={valid ? session : null} initialRole={valid && session ? session.role : null}>
      <CustomerProvider>
        <AdminRootLayout>{children}</AdminRootLayout>
      </CustomerProvider>
    </SessionProvider>
  );
}