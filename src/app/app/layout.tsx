import React from 'react';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { SessionProvider } from '@/lib/auth-system/sessionHooks';
import AppShell from './AppShell';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. Validate Session Server-Side
    // We pass 'cookies()' explicitly if needed, but validateSession defaults to it.
    const validation = await SessionManager.validateSession();

    // 2. Handle Invalid Session
    if (!validation.valid || !validation.session) {
        redirect('/login');
    }

    // 3. Extract Session Data
    const sessionData = validation.session;
    const userRole = sessionData.role;

    // 4. Pass Server-Side Session to Client Provider
    // This "hydrates" the SessionProvider immediately, preventing the "flicker"
    // where it thinks you are logged out for a split second.
    return (
        <SessionProvider
            initialSession={sessionData}
            initialRole={userRole}
        >
            <AppShell>
                {children}
            </AppShell>
        </SessionProvider>
    );
}
