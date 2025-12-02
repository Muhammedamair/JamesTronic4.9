'use client';

import React, { useState } from 'react';
import { DeviceIntakeForm } from '@/components/ui/device-intake-form';
import { createTicketService, createCustomerService, TicketWithCustomer } from '@/lib/services/authenticated-service';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { BookingConfirmationTrust } from '@/components/trust/booking-confirmation-trust';
import { BookingFlowProvider, useBookingFlow } from '@/components/booking/BookingFlowProvider';
import { BookingFlowTracker } from '@/components/booking/BookingFlowTracker';

const CreateTicketPageContent = () => {
  const { supabase } = useSupabase();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { initializeBooking, updateBookingState, completeBooking } = useBookingFlow();
  const ticketService = createTicketService(supabase);
  const customerService = createCustomerService(supabase);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // First create customer, then create ticket with the customer ID
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      // Initialize booking flow
      const profile = await supabase.auth.getUser();
      const userId = profile.data.user?.id;

      if (userId) {
        await initializeBooking(
          `temp_${Date.now()}`, // We'll update this with actual ticket ID after creation
          userId,
          ticketData.deviceCategory,
          ticketData.brand
        );

        // Update booking state to validating
        await updateBookingState('validating');
      }

      // Check if customer already exists by phone number
      let customer = await supabase
        .from('customers')
        .select('*')
        .eq('phone_e164', ticketData.customerPhone)
        .single();

      let customerId;
      if (customer.data) {
        // Customer already exists, use existing ID
        customerId = customer.data.id;
      } else {
        // Create new customer
        const newCustomer = await customerService.create({
          name: ticketData.customerName,
          phone_e164: ticketData.customerPhone,
          area: ticketData.customerArea,
        });
        customerId = newCustomer.id;
      }

      // Create the ticket with the customer ID - Ensure no technician is assigned initially
      const newTicket = await ticketService.create({
        customer_id: customerId,
        device_category: ticketData.deviceCategory,
        brand: ticketData.brand || null,
        model: ticketData.model || null,
        size_inches: ticketData.size ? parseInt(ticketData.size) : null,
        issue_summary: ticketData.issueSummary || null,
        issue_details: ticketData.issueDetails || null,
        status: 'pending', // Default status
        assigned_technician_id: null, // Set to null to ensure unassigned
        assigned_transporter_id: null,
        quoted_price: null,
        status_reason: null,
        created_by: null,
      });

      return newTicket;
    },
    onSuccess: async (data) => {
      setIsSubmitted(true);
      setTicketId(data.id);

      // Update booking flow with actual ticket ID
      const profile = await supabase.auth.getUser();
      const userId = profile.data.user?.id;

      if (userId) {
        // Re-initialize booking with actual ticket ID
        await initializeBooking(
          data.id,
          userId,
          createTicketMutation.variables?.deviceCategory,
          createTicketMutation.variables?.brand
        );

        await updateBookingState('confirmed');
        await completeBooking();
      }

      // Show success toast
      toast({
        title: 'Ticket Created',
        description: `Ticket #${data.id.substring(0, 8)} has been created successfully.`,
      });

      // Invalidate the tickets query to refresh the list
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

  const handleBackToTickets = () => {
    router.push('/app/tickets');
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
                Your service request has been recorded. Our technician will contact you shortly.
              </p>
            </div>

            {/* Booking confirmation trust section */}
            <BookingConfirmationTrust
              ticketId={ticketId || ''}
              deviceCategory={createTicketMutation.variables?.deviceCategory}
            />
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={handleBackToTickets}>
              Back to Tickets
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      {/* Booking flow tracker */}
      <BookingFlowTracker />
      <DeviceIntakeForm onSubmit={handleSubmit} />
    </div>
  );
};

const CreateTicketPage = () => {
  return (
    <BookingFlowProvider>
      <CreateTicketPageContent />
    </BookingFlowProvider>
  );
};

export default CreateTicketPage;