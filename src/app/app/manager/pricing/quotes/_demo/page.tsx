'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuotesTable } from '@/components/pricing/quotes/QuotesTable';
import { NewQuoteDrawer } from '@/components/pricing/quotes/NewQuoteDrawer';
import { QuoteBreakdownDrawer } from '@/components/pricing/quotes/QuoteBreakdownDrawer';
import { AcceptQuoteDialog } from '@/components/pricing/quotes/AcceptQuoteDialog';
import { Quote, CreateQuotePayload } from '@/components/pricing/quotes/types';
import { toast } from 'sonner';

// Mock Data
const MOCK_QUOTES: Quote[] = [
    {
        id: 'Q-12345',
        quote_key: 'key_1',
        city_id: 'nyc',
        service_code: 'HVAC-REPAIR-01',
        labor_amount: 150,
        parts_amount: 50,
        parts_cost: 40,
        transport_amount: 30,
        diagnostic_amount: 75,
        urgency_surcharge: 0,
        complexity_surcharge: 0,
        discount_amount: 0,
        tax_amount: 25.5,
        total_amount: 330.5,
        ruleset_id: 'rs_1',
        ruleset_version: 'v1.2.0',
        base_rate_ref: { id: 'br_1', rate: 150 },
        guardrail_ref: { id: 'gr_1', max: 500 },
        breakdown: {
            labor: 150,
            parts: 50,
            transport: 30,
            diagnostic: 75,
            urgency_surcharge: 0,
            complexity_surcharge: 0,
            subtotal_before_guardrails: 305
        },
        reason_codes: [],
        status: 'pending',
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour from now
        created_at: new Date().toISOString(),
        created_by: 'user_1'
    },
    {
        id: 'Q-67890',
        quote_key: 'key_2',
        city_id: 'nyc',
        service_code: 'PLUMBING-LEAK',
        labor_amount: 200,
        parts_amount: 20,
        parts_cost: 15,
        transport_amount: 30,
        diagnostic_amount: 75,
        urgency_surcharge: 50,
        complexity_surcharge: 0,
        discount_amount: 0,
        tax_amount: 32.5,
        total_amount: 407.5,
        ruleset_id: 'rs_1',
        ruleset_version: 'v1.2.0',
        base_rate_ref: {},
        guardrail_ref: {},
        breakdown: {
            labor: 200,
            parts: 20,
            transport: 30,
            diagnostic: 75,
            urgency_surcharge: 50,
            complexity_surcharge: 0,
            subtotal_before_guardrails: 375
        },
        reason_codes: ['URGENCY_HIGH'],
        status: 'accepted',
        expires_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        accepted_at: new Date(Date.now() - 3600 * 1000 * 23).toISOString(),
        accepted_by: 'manager_1',
        created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
        created_by: 'user_1'
    },
    {
        id: 'Q-EXPIRED',
        quote_key: 'key_3',
        city_id: 'nyc',
        service_code: 'ELECTRICAL-FIX',
        labor_amount: 100,
        parts_amount: 0,
        parts_cost: 0,
        transport_amount: 30,
        diagnostic_amount: 75,
        urgency_surcharge: 0,
        complexity_surcharge: 0,
        discount_amount: 0,
        tax_amount: 15,
        total_amount: 220,
        ruleset_id: 'rs_1',
        ruleset_version: 'v1.2.0',
        base_rate_ref: {},
        guardrail_ref: {},
        breakdown: {
            labor: 100,
            parts: 0,
            transport: 30,
            diagnostic: 75,
            urgency_surcharge: 0,
            complexity_surcharge: 0,
            subtotal_before_guardrails: 205
        },
        reason_codes: [],
        status: 'pending', // Expired strictly by date
        expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
        created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
        created_by: 'user_1'
    }
];

export default function QuotesDemoPage() {
    const [quotes, setQuotes] = useState<Quote[]>(MOCK_QUOTES);
    const [showNewDrawer, setShowNewDrawer] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [quoteToAccept, setQuoteToAccept] = useState<Quote | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreate = (payload: CreateQuotePayload) => {
        setIsSubmitting(true);
        // Simulate API delay
        setTimeout(() => {
            const newQuote: Quote = {
                ...MOCK_QUOTES[0],
                id: `Q-${Math.floor(Math.random() * 10000)}`,
                service_code: payload.service_code,
                status: 'pending',
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            };
            setQuotes([newQuote, ...quotes]);
            setIsSubmitting(false);
            setShowNewDrawer(false);
            toast.success('Quote created (Mock)');
        }, 1000);
    };

    const handleAccept = (reason?: string) => {
        if (!quoteToAccept) return;
        setIsSubmitting(true);
        setTimeout(() => {
            setQuotes(quotes.map(q =>
                q.id === quoteToAccept.id
                    ? { ...q, status: 'accepted', accepted_at: new Date().toISOString() }
                    : q
            ));
            setIsSubmitting(false);
            setQuoteToAccept(null);
            toast.success('Quote accepted (Mock)');
        }, 1000);
    };

    return (
        <div className="p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Quotes UI Component Demo</h1>
                    <p className="text-muted-foreground">Visual harness for PR1 components (No API)</p>
                </div>
                <Button onClick={() => setShowNewDrawer(true)}>Create Quote</Button>
            </div>

            <QuotesTable
                data={quotes}
                onView={(q) => {
                    setSelectedQuote(q);
                    setShowBreakdown(true);
                }}
                onAccept={(q) => setQuoteToAccept(q)}
            />

            <NewQuoteDrawer
                open={showNewDrawer}
                onOpenChange={setShowNewDrawer}
                onSubmit={handleCreate}
                isSubmitting={isSubmitting}
                serviceCodes={['HVAC-REPAIR', 'PLUMBING-FIX', 'ELEC-INSPECT']}
                cityId="nyc"
            />

            <QuoteBreakdownDrawer
                quote={selectedQuote}
                open={showBreakdown}
                onOpenChange={setShowBreakdown}
            />

            <AcceptQuoteDialog
                quote={quoteToAccept}
                open={!!quoteToAccept}
                onOpenChange={(open) => !open && setQuoteToAccept(null)}
                onConfirm={handleAccept}
                isSubmitting={isSubmitting}
            />
        </div>
    );
}
