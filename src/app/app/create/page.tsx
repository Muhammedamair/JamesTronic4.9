'use client';

import React, { useState } from 'react';
import { DeviceIntakeForm } from '@/components/ui/device-intake-form';
import { createTicketService, createCustomerService, TicketWithCustomer } from '@/lib/authenticated-service';
import { useSupabase } from '@/components/supabase-provider';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const CreateTicketPage = () => {
  const { supabase } = useSupabase();
  const queryClient = useQueryClient();
  const router = useRouter();
  const ticketService = createTicketService(supabase);
  const customerService = createCustomerService(supabase);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // First create customer, then create ticket with the customer ID
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: any) => {
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
      return await ticketService.create({
        customer_id: customerId,
        device_category: ticketData.deviceCategory,
        brand: ticketData.brand,
        model: ticketData.model,
        size_inches: ticketData.size ? parseInt(ticketData.size) : undefined,
        issue_summary: ticketData.issueSummary,
        issue_details: ticketData.issueDetails,
        status: 'pending', // Default status
        assigned_technician_id: null, // Explicitly set to null to ensure unassigned
      });
    },
    onSuccess: (data) => {
      setIsSubmitted(true);
      setTicketId(data.id);

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
        variant: 'error',
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
          <CardContent className="text-center">
            <p className="text-lg mb-2">Ticket ID: <span className="font-mono font-bold">#{ticketId?.substring(0, 8)}</span></p>
            <p className="text-gray-600 dark:text-gray-400">
              Your service request has been recorded. Our technician will contact you shortly.
            </p>
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
      <DeviceIntakeForm onSubmit={handleSubmit} />
    </div>
  );
};

export default CreateTicketPage;