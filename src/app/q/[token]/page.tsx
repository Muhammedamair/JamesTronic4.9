import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import CustomerQuoteClient from './CustomerQuoteClient';

export default async function QuoteSharePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // Redirect to login with next param
        // Ensuring next parameter is correctly encoded
        redirect(`/login?next=${encodeURIComponent(`/q/${token}`)}`);
    }

    return <CustomerQuoteClient token={token} />;
}
