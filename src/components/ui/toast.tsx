import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const toastVariants = cva(
  'flex items-center justify-between p-4 rounded-lg shadow-lg transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'bg-white text-gray-900 border border-gray-200',
        success: 'bg-green-100 text-green-800 border border-green-200',
        error: 'bg-red-100 text-red-800 border border-red-200',
        warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
        info: 'bg-blue-100 text-blue-800 border border-blue-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
  showClose?: boolean;
}

const Toast: React.FC<ToastProps> = ({
  title,
  description,
  variant,
  duration = 5000,
  onClose,
  showClose = true,
  className,
  ...props
}) => {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className={cn(toastVariants({ variant, className }))} {...props}>
      <div>
        <h4 className="font-medium">{title}</h4>
        {description && <p className="text-sm mt-1 opacity-90">{description}</p>}
      </div>
      {showClose && (
        <button 
          onClick={onClose}
          className="ml-4 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export { Toast, toastVariants };