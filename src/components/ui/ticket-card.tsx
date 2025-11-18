import React, { useState } from 'react';
import { StatusPill } from './status-pill';
import { ActionBar } from './action-bar';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TicketCardProps {
  id: string;
  customerName: string;
  customerPhone: string;
  customerArea?: string;
  deviceCategory: string;
  brand: string;
  model: string;
  issueSummary: string;
  status: string;
  createdAt: string;
  className?: string;
  onUpdateStatus?: (status: string) => void;
  onDelete?: () => void;
}

const TicketCard: React.FC<TicketCardProps> = ({
  id,
  customerName,
  customerPhone,
  customerArea,
  deviceCategory,
  brand,
  model,
  issueSummary,
  status,
  createdAt,
  className,
  onUpdateStatus,
  onDelete
}) => {
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'part_required', label: 'Part Required' },
    { value: 'ready', label: 'Ready' },
    { value: 'waiting_customer', label: 'Waiting for Customer' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const handleStatusChange = (newStatus: string) => {
    if (newStatus !== status && onUpdateStatus) {
      onUpdateStatus(newStatus);
    }
    setIsStatusDropdownOpen(false);
  };

  const currentStatusLabel = statusOptions.find(opt => opt.value === status)?.label || status;

  return (
    <motion.div 
      className={cn("bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.2, 
        type: "spring", 
        stiffness: 220, 
        damping: 26 
      }}
      whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      layout // Add layout animation for smoother transitions
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{customerName}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{customerPhone}</p>
          {customerArea && customerArea !== 'N/A' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Area: {customerArea}</p>
          )}
        </div>
        
        {/* Status dropdown with inline StatusPill */}
        <div className="relative">
          <button
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-haspopup="listbox"
            aria-expanded={isStatusDropdownOpen}
            aria-label={`Change status for ticket ${id.substring(0, 8)}`}
          >
            <StatusPill status={status} />
            {isStatusDropdownOpen ? (
              <ChevronUp className="ml-1 h-4 w-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDown className="ml-1 h-4 w-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
          
          {isStatusDropdownOpen && (
            <div 
              className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 z-10"
              role="listbox"
            >
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  className={`block w-full text-left px-4 py-2 text-sm ${
                    option.value === status
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleStatusChange(option.value)}
                  role="option"
                  aria-selected={option.value === status}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {deviceCategory} {brand && `(${brand}`}{model && ` ${model}`}{brand && ')'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{issueSummary}</p>
      </div>
      
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Ticket #{id.substring(0, 8)}
      </div>
      
      <div className="mt-4">
        <ActionBar 
          ticketId={id} 
          customerName={customerName} 
          customerPhone={customerPhone} 
          status={status}
          onDelete={onDelete}
        />
      </div>
    </motion.div>
  );
};

export { TicketCard };