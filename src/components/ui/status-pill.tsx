import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Clock, Wrench, Puzzle, CheckCircle, Phone, XCircle, Ban } from 'lucide-react';

// Define the known status variants
type StatusVariant = 'default' | 'pending' | 'in_progress' | 'part_required' | 'ready' | 'waiting_customer' | 'failed' | 'cancelled';

const statusPillVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 capitalize',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80',
        in_progress: 'bg-blue-100 text-blue-800 hover:bg-blue-100/80',
        part_required: 'bg-orange-100 text-orange-800 hover:bg-orange-100/80',
        ready: 'bg-green-100 text-green-800 hover:bg-green-100/80',
        waiting_customer: 'bg-purple-100 text-purple-800 hover:bg-purple-100/80',
        failed: 'bg-red-100 text-red-800 hover:bg-red-100/80',
        cancelled: 'bg-gray-100 text-gray-800 hover:bg-gray-100/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface StatusPillProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusPillVariants> {
  status: string;
}

const StatusPill = ({ status, className, ...props }: StatusPillProps) => {
  // Format the status for display (replace underscores with spaces and capitalize)
  const formattedStatus = status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Determine the appropriate variant based on the status
  const variant: StatusVariant = 
    status === 'pending' || status === 'in_progress' || status === 'part_required' || 
    status === 'ready' || status === 'waiting_customer' || status === 'failed' || 
    status === 'cancelled' ? status : 'default';

  // Determine the appropriate icon based on the status
  let StatusIcon = null;
  
  switch (status) {
    case 'pending':
      StatusIcon = Clock;
      break;
    case 'in_progress':
      StatusIcon = Wrench;
      break;
    case 'part_required':
      StatusIcon = Puzzle;
      break;
    case 'ready':
      StatusIcon = CheckCircle;
      break;
    case 'waiting_customer':
      StatusIcon = Phone;
      break;
    case 'failed':
      StatusIcon = XCircle;
      break;
    case 'cancelled':
      StatusIcon = Ban;
      break;
    default:
      StatusIcon = null;
  }

  return (
    <div
      className={cn(statusPillVariants({ variant, className }))}
      {...props}
    >
      {StatusIcon && <StatusIcon className="mr-1 h-3 w-3" />}
      {formattedStatus}
    </div>
  );
};

export { StatusPill, statusPillVariants };