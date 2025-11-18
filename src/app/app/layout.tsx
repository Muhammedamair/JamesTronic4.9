// With middleware handling auth, this layout is for authenticated users only
import { ReactNode } from 'react';
import { Header } from '@/components/ui/header';

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}