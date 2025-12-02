import { useContext } from 'react';
import { CustomerContext, CustomerContextType } from '@/components/customer/customer-provider';

export type { CustomerContextType };

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
}