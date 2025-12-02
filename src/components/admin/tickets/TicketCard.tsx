import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { User, Wrench, MapPin, Clock } from 'lucide-react';
import { Ticket } from '@/lib/types/ticket';

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
  className?: string;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  onClick,
  className
}) => {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'default';
      case 'in_progress':
        return 'secondary';
      case 'part_required':
        return 'secondary';
      case 'ready':
        return 'default';
      case 'waiting_customer':
        return 'outline';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card
      className={cn(
        "border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Ticket #{ticket.id.substring(0, 8)}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(ticket.created_at).toLocaleDateString()}
              </p>
            </div>
            <Badge variant={getStatusVariant(ticket.status)}>
              {ticket.status}
            </Badge>
          </div>

          <div className="space-y-1">
            <div className="flex items-center">
              <User className="h-4 w-4 text-gray-400 mr-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {ticket.customer?.name || 'N/A'}
              </p>
            </div>

            <div className="flex items-center">
              <Wrench className="h-4 w-4 text-gray-400 mr-2" />
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {ticket.device_category} {ticket.brand} {ticket.model}
              </p>
            </div>

            <div className="flex items-center">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <p className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {ticket.customer?.name || 'N/A'} area
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
              {ticket.issue_summary}
            </p>
          </div>

          {ticket.assigned_technician && (
            <div className="flex items-center pt-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center">
                <div className="h-2 w-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {ticket.assigned_technician.full_name}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};