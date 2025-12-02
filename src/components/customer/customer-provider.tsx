'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useSupabase } from '@/components/shared/supabase-provider';
import { customerAPI, Ticket } from '@/lib/api/customer';

interface Customer {
  id: string;
  name: string;
  phone_e164: string;
  area?: string | null;
  created_at: string;
}

export type CustomerContextType = {
  isCustomer: boolean;
  customerData: Customer | null;
  customerTickets: Ticket[] | null;
  isLoading: boolean;
  refetchCustomerData: () => Promise<void>;
};

export const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useSupabase();
  const [isCustomer, setIsCustomer] = useState<boolean>(false);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [customerTickets, setCustomerTickets] = useState<Ticket[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check if the authenticated user is a customer
  const checkCustomerStatus = async () => {
    if (!user) {
      setIsCustomer(false);
      setCustomerData(null);
      setCustomerTickets(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get customer tickets data - if successful, user has customer access rights
      const customerTicketsData = await customerAPI.getMyTickets();

      if (customerTicketsData && customerTicketsData.length > 0) {
        // If they have tickets, they are definitely a customer
        setIsCustomer(true);
        // Get the customer data from the first ticket (all should belong to same customer)
        const firstTicket = customerTicketsData[0];
        if (firstTicket.customer) {
          setCustomerData({
            id: firstTicket.customer_id,
            name: firstTicket.customer.name,
            phone_e164: firstTicket.customer.phone_e164,
            created_at: firstTicket.created_at
          });
        }
        setCustomerTickets(customerTicketsData);
      } else {
        // If no tickets but they can access the customer API without error,
        // they might be a customer who hasn't created any tickets yet
        setIsCustomer(true);
        setCustomerTickets([]);
      }
    } catch (error) {
      // If API call fails with unauthorized, they're not a customer
      console.error('Error checking customer status:', error);
      if (error instanceof Error && error.message.includes('401')) {
        setIsCustomer(false);
        setCustomerData(null);
        setCustomerTickets(null);
      } else {
        // Other errors might be temporary, so we'll keep status as it was
        setIsCustomer(false);
        setCustomerData(null);
        setCustomerTickets(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch customer data
  const refetchCustomerData = async () => {
    await checkCustomerStatus();
  };

  useEffect(() => {
    // Only check when auth state is loaded
    if (!authLoading) {
      checkCustomerStatus();
    } else {
      setIsLoading(true);
    }
  }, [user, authLoading]);

  const value = {
    isCustomer,
    customerData,
    customerTickets,
    isLoading,
    refetchCustomerData
  };

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
}