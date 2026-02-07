import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCustomerService, createTicketService } from '@/lib/services/authenticated-service';
import { ZodError, z } from 'zod';

// Define validation schema
const ticketSchema = z.object({
    customerName: z.string().min(1, "Name is required"),
    customerPhone: z.string().min(1, "Phone is required"),
    customerArea: z.string().min(1, "Area is required"),
    deviceCategory: z.string().min(1, "Device category is required"),
    brand: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    size: z.string().optional().nullable(),
    issueSummary: z.string().optional().nullable(),
    issueDetails: z.string().optional().nullable(),
    commonIssue: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate request body
        const validatedData = ticketSchema.parse(body);

        // Use Admin Client to bypass RLS
        const adminClient = createAdminClient();
        const customerService = createCustomerService(adminClient);
        const ticketService = createTicketService(adminClient);

        console.log('API: Creating ticket with validated data:', validatedData);

        // 1. Find or Create Customer
        let customerId: string;
        let branchId: string;

        // Fetch a default branch since it's a NOT NULL constraint
        const { data: defaultBranch, error: branchError } = await adminClient
            .from('branches')
            .select('id')
            .limit(1)
            .single();

        if (branchError || !defaultBranch) {
            console.error('API: Failed to fetch a default branch:', branchError);
            throw new Error('System configuration error: No active service branch found.');
        }
        branchId = defaultBranch.id;
        console.log('API: Using branch ID:', branchId);

        // Check if customer already exists by phone number
        const { data: existingCustomer, error: findError } = await adminClient
            .from('customers')
            .select('id')
            .eq('phone_e164', validatedData.customerPhone)
            .single();

        if (existingCustomer) {
            customerId = existingCustomer.id;
        } else {
            // Create new customer
            const newCustomer = await customerService.create({
                name: validatedData.customerName,
                phone_e164: validatedData.customerPhone,
                area: validatedData.customerArea,
            });
            customerId = newCustomer.id;
        }

        // 2. Create Ticket
        const newTicket = await ticketService.create({
            customer_id: customerId,
            branch_id: branchId, // Required field
            device_category: validatedData.deviceCategory,
            brand: validatedData.brand || null,
            model: validatedData.model || null,
            size_inches: (validatedData.size && !isNaN(parseInt(validatedData.size))) ? parseInt(validatedData.size) : null,
            issue_summary: validatedData.commonIssue || validatedData.issueSummary || `Repair request for ${validatedData.deviceCategory}`,
            issue_details: validatedData.issueDetails || null,
            status: 'pending',
            assigned_technician_id: null,
            assigned_transporter_id: null,
            quoted_price: null,
            status_reason: null,
            created_by: null, // System created
        });

        return new Response(JSON.stringify(newTicket), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('API: Error creating ticket:', error);

        // Log environment status for debugging
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing');
        }

        if (error instanceof ZodError) {
            return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Return the actual error message in dev mode or for debugging
        const errObj = error as any;
        const errorMessage = errObj?.message || (typeof error === 'string' ? error : 'Internal Server Error');

        return new Response(JSON.stringify({
            error: errorMessage,
            details: errObj?.details || errObj?.hint || null,
            code: errObj?.code || null
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
