'use client';

import React, { useState, useEffect } from 'react';
import { RightDrawer } from '@/components/admin/drawers/RightDrawer';
import { SkeletonLoader } from '@/components/admin/shared/SkeletonLoader';
import { TechnicianRecommendationList } from '@/components/admin/tickets/TechnicianRecommendationList';
import { toast } from '@/components/ui/use-toast';
import { ticketApi } from '@/lib/api/tickets';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, User, Wrench } from 'lucide-react';
import { Ticket } from '@/lib/types/ticket';

interface TicketAssignmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onAssignmentComplete: () => void;
}

export const TicketAssignmentDrawer: React.FC<TicketAssignmentDrawerProps> = ({
  isOpen,
  onClose,
  ticket,
  onAssignmentComplete
}) => {
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSelectedTechnicianId(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleAssignTicket = async () => {
    if (!ticket || !selectedTechnicianId) {
      toast({
        title: 'Error',
        description: 'Please select a technician first',
        variant: 'destructive'
      });
      return;
    }

    setIsAssigning(true);

    try {
      const updatedTicket = await ticketApi.assignTicket(ticket.id, selectedTechnicianId);

      toast({
        title: 'Success',
        description: `Ticket assigned to technician successfully`
      });

      onAssignmentComplete();
      onClose();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign ticket. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsAssigning(false);
    }
  };

  if (!ticket) {
    return null;
  }

  // Calculate SLA color indicator based on ticket age
  const createdAt = new Date(ticket.created_at);
  const now = new Date();
  const timeDiffMs = now.getTime() - createdAt.getTime();
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

  let slaColor = 'bg-green-500';
  if (timeDiffHours > 24) {
    slaColor = 'bg-yellow-500';
  }
  if (timeDiffHours > 48) {
    slaColor = 'bg-red-500';
  }

  return (
    <RightDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Technician"
      onSubmit={handleAssignTicket}
      submitLabel="Assign Technician"
    >
      <div className="space-y-6">
        {/* Ticket Details */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ticket Details</h3>
            <Badge className={`${slaColor} text-white`}>
              {timeDiffHours < 24 ? 'Fresh' : timeDiffHours < 48 ? 'Urgent' : 'Overdue'}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-start">
              <User className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {ticket.customer?.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ticket.customer?.phone_e164 || 'No phone'}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <Wrench className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-medium">Device:</span> {ticket.device_category} {ticket.brand} {ticket.model}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-gray-900 dark:text-white">
                <span className="font-medium">Location:</span> {ticket.customer?.name || 'N/A'} area
              </p>
            </div>

            <div className="flex items-start">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-medium">Created:</span> {new Date(ticket.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {Math.floor(timeDiffHours)} hours ago
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Issue Summary</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {ticket.issue_summary}
              </p>
            </div>
          </div>
        </div>

        {/* Technician Selection */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Select Technician
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              <SkeletonLoader variant="rect" height="80px" />
              <SkeletonLoader variant="rect" height="80px" />
              <SkeletonLoader variant="rect" height="80px" />
            </div>
          ) : (
            <TechnicianRecommendationList
              onSelect={setSelectedTechnicianId}
              selectedId={selectedTechnicianId}
              ticket={ticket}
            />
          )}
        </div>

        {/* Assignment Button */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            className="w-full"
            onClick={handleAssignTicket}
            disabled={isAssigning || !selectedTechnicianId}
          >
            {isAssigning ? 'Assigning...' : `Assign Ticket to Technician`}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
};