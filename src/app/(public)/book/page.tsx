'use client';

import React, { useState } from 'react';
import { DeviceIntakeForm } from '@/components/ui/device-intake-form';
import { createTicketService, createCustomerService } from '@/lib/services/authenticated-service';
import { useSupabase } from '@/components/shared/supabase-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { BookingConfirmationTrust } from '@/components/trust/booking-confirmation-trust';
import { BookingFlowProvider, useBookingFlow } from '@/components/booking/BookingFlowProvider';
import { BookingFlowTracker } from '@/components/booking/BookingFlowTracker';
import { Suspense } from 'react';

const CreateTicketPageContent = () => {
  const { supabase } = useSupabase();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');

  const { initializeBooking, updateBookingState, completeBooking } = useBookingFlow();

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Call the server-side API to create the ticket
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
      // Initialize booking flow
      const profile = await supabase.auth.getUser();
      const userId = profile.data.user?.id;

      if (userId) {
        await initializeBooking(
          `temp_${Date.now()}`,
          userId,
          ticketData.deviceCategory,
          ticketData.brand
        );

        // Update booking state to validating
        await updateBookingState('validating');
      }

      // Call the API endpoint
      const response = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create ticket');
      }

      const newTicket = await response.json();
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

        // Transition through valid states sequentially:
        // initiated → validating → technician-match → assigned → accepted → confirmed → completed
        await updateBookingState('validating');
        await updateBookingState('technician-match');
        await updateBookingState('assigned');
        await updateBookingState('accepted');
        await updateBookingState('confirmed');
        await updateBookingState('escrow-pending');
        await completeBooking();
      }

      // Show success toast
      toast({
        title: 'Ticket Created',
        description: `Ticket #${data.id.substring(0, 8)} has been created successfully.`,
      });

      // Invalidate the tickets query to refresh the list if needed
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => {
      console.error('CRITICAL: Error creating ticket:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create ticket',
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (formData: any) => {
    console.log('BookPage: handleSubmit triggered with data:', formData);
    // Ensure mutation is called
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
            <Button onClick={handleBackToHome}>
              Back to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold mb-6 text-center">Book a Repair</h1>
      {/* Booking flow tracker */}
      <BookingFlowTracker />
      <DeviceIntakeForm
        onSubmit={handleSubmit}
        initialCategory={categoryParam || undefined}
      />
    </div>
  );
};

const CreateTicketPage = () => {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading booking form...</div>}>
      <BookingFlowProvider>
        <CreateTicketPageContent />
      </BookingFlowProvider>
    </Suspense>
  );
};

export default CreateTicketPage;