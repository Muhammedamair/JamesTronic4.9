'use client';

import React, { useState, useEffect } from 'react';
import { createTicketService, createCustomerService } from '@/lib/services/authenticated-service';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { BookingConfirmationTrust } from '@/components/trust/booking-confirmation-trust';
import { useBookingFlow } from '@/components/booking/BookingFlowProvider';
import { BookingFlowTracker } from '@/components/booking/BookingFlowTracker';
import { AuthWall } from '@/components/auth/AuthWall';
import { useGuestBookingDraft } from '@/store/guestBookingDraft';

// New Booking Components
import { PublicBookingForm } from '@/components/booking/PublicBookingForm';
import { CartSidebar } from '@/components/booking/CartSidebar';

const PublicBookingPageContent = () => {
  const { supabase, user } = useSupabase();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initializeBooking, updateBookingState, completeBooking } = useBookingFlow();
  const { draft, updateDraft, clearDraft } = useGuestBookingDraft();
  const ticketService = createTicketService(supabase);
  const customerService = createCustomerService(supabase);

  // Get category from URL or draft - MOVED UP before state initialization
  const categoryFromUrl = searchParams.get('category');
  const category = categoryFromUrl || draft?.category || 'television';
  const storeId = searchParams.get('store');

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [showAuthWall, setShowAuthWall] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerArea: '',
    customerStreet: '',
    deviceCategory: category, // Now accessible
    brand: '',
    model: '',
    size: '',
    issueSummary: '',
    issueDetails: '',
    commonIssue: ''
  });

  // Initialize form data from draft if available
  useEffect(() => {
    if (draft) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        deviceCategory: draft.category || category,
        brand: draft.serviceId || '',
        issueSummary: draft.issues?.join(', ') || '',
        issueDetails: draft.issues?.join('\n') || '',
        customerArea: draft.address?.city || '',
        customerStreet: draft.address?.street || '',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        deviceCategory: category,
      }));
    }
  }, [draft, category]);

  // Handle Form Changes
  const handleFormChange = (data: any) => {
    setFormData(data);
  };

  // Calculate cart items for sidebar
  const getCartItems = () => {
    const items = [];
    if (formData.deviceCategory) {
      items.push({
        id: 'service-charge',
        name: `${formData.deviceCategory.charAt(0).toUpperCase() + formData.deviceCategory.slice(1)} Repair Consultation`,
        price: 199,
        details: formData.brand ? `${formData.brand} ${formData.model}` : 'Standard Consultation'
      });
    }
    return items;
  };

  // Ticket Creation Mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      // Check if user is authenticated before proceeding
      if (!user) {
        // If not authenticated, set draft with the ticket data and show auth wall
        updateDraft({
          category: ticketData.deviceCategory,
          serviceId: ticketData.brand,
          serviceSlug: null,
          issues: [ticketData.issueSummary, ticketData.issueDetails].filter(Boolean),
          address: {
            street: ticketData.customerStreet,
            city: ticketData.customerArea,
            state: 'Telangana', // Default state
            pincode: '' // Will be filled later
          },
          timeSlot: null,
          pricing: null,
          createdAt: new Date().toISOString(),
        });

        setShowAuthWall(true);
        return null;
      }

      // Initialize booking flow
      const userId = user.id;

      if (userId) {
        await initializeBooking(
          `temp_${Date.now()}`,
          userId,
          ticketData.deviceCategory,
          ticketData.brand
        );

        await updateBookingState('validating');
      }

      // 1. Normalize phone number
      const normalizedPhone = ticketData.customerPhone.startsWith('+')
        ? ticketData.customerPhone
        : `+${ticketData.customerPhone.replace(/[^0-9]/g, '')}`;

      let customerId;

      // 2. Try to find customer by user_id
      const { data: customerByUserId } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (customerByUserId) {
        customerId = customerByUserId.id;
      } else {
        // 3. Try to find customer by phone number
        const { data: customerByPhone } = await supabase
          .from('customers')
          .select('id, user_id')
          .eq('phone_e164', normalizedPhone)
          .maybeSingle();

        if (customerByPhone) {
          customerId = customerByPhone.id;
          if (!customerByPhone.user_id) {
            await supabase
              .from('customers')
              .update({ user_id: user.id })
              .eq('id', customerId);
          }
        } else {
          // 4. Create new customer
          const newCustomer = await customerService.create({
            name: ticketData.customerName,
            phone_e164: normalizedPhone,
            area: ticketData.customerArea,
            user_id: user.id
          } as any);
          customerId = newCustomer.id;
        }
      }

      // Create ticket
      const newTicket = await ticketService.create({
        customer_id: customerId,
        device_category: ticketData.deviceCategory,
        brand: ticketData.brand || null,
        model: ticketData.model || null,
        size_inches: ticketData.size ? parseInt(ticketData.size) : null,
        issue_summary: ticketData.issueSummary || 'Service Request',
        issue_details: ticketData.issueDetails || null,
        status: 'pending',
        assigned_technician_id: null,
        assigned_transporter_id: null,
        quoted_price: null,
        status_reason: null,
        created_by: user!.id,
        branch_id: (storeId || null) as any,
      });

      return newTicket;
    },
    onSuccess: async (data) => {
      if (!data) return;

      setIsSubmitted(true);
      setTicketId(data.id);

      const userId = user?.id;
      if (userId) {
        await initializeBooking(
          data.id,
          userId,
          createTicketMutation.variables?.deviceCategory,
          createTicketMutation.variables?.brand
        );
        await updateBookingState('confirmed');
        await completeBooking();
      }

      clearDraft();
      toast({
        title: 'Ticket Created',
        description: `Ticket #${data.id.substring(0, 8)} has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => {
      console.error('Error creating ticket:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create ticket',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (formData: any) => {
    createTicketMutation.mutate(formData);
  };

  const handleBackToHome = () => {
    router.push('/');
  };

  if (isSubmitted) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Ticket Created Successfully!</CardTitle>
            <CardDescription>
              Your service request has been submitted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <p className="text-lg mb-2">Ticket ID: <span className="font-mono font-bold">#{ticketId?.substring(0, 8)}</span></p>
              <p className="text-gray-600 dark:text-gray-400">
                Your service request has been recorded. Our team will contact you shortly.
              </p>
            </div>
            <BookingConfirmationTrust
              ticketId={ticketId || ''}
              deviceCategory={createTicketMutation.variables?.deviceCategory || category}
            />
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={handleBackToHome}>
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <BookingFlowTracker />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Book a Repair</h1>
          <p className="text-gray-500 mt-2">Expert technicians at your doorstep in 60 minutes</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Main Form Area */}
          <div className="flex-1 w-full">
            <PublicBookingForm
              initialData={{
                deviceCategory: category,
                brand: draft?.serviceId || '',
                issueSummary: draft?.issues?.join(', ') || '',
                issueDetails: draft?.issues?.join('\n') || '',
                customerArea: draft?.address?.city || '',
                customerStreet: draft?.address?.street || '',
                customerName: '', // These will be managed by local state but initialized if drafting logic expands
                customerPhone: ''
              }}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
            />
          </div>

          {/* Cart Sidebar */}
          <CartSidebar
            items={getCartItems()}
            total={199}
            onCheckout={() => {
              // Trigger hidden form submit button for simplicity
              const submitBtn = document.querySelector('button[type="submit"]');
              if (submitBtn) {
                (submitBtn as HTMLButtonElement).click();
              }
            }}
            isLoading={createTicketMutation.isPending}
          />
        </div>
      </div>

      <AuthWall
        open={showAuthWall}
        onOpenChange={setShowAuthWall}
        actionDescription="confirm your booking"
      />
    </div>
  );
};

export default PublicBookingPageContent;