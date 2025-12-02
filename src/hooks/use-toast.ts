import { useToast as useUiToast } from '@/components/ui/use-toast';

// Re-export the use-toast hook from the UI directory to be accessible via the hooks directory
export const useToast = () => {
  return useUiToast();
};