import { Toast } from './toast';

interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export function toast({ title, description, variant = 'default', duration = 5000 }: ToastProps) {
  // In a real implementation, this would show the toast in a portal
  // For now, we'll just use console.log to simulate it
  console.log(`Toast: ${title} - ${description}`);
  
  // This would normally render the Toast component in a portal
  // Here we're just simulating the behavior
  return {
    id: Date.now().toString(),
    dismiss: () => console.log('Toast dismissed'),
    update: (props: ToastProps) => console.log('Toast updated', props),
  };
}