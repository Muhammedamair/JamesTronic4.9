'use client';

import { useState, useEffect } from 'react';
import { TicketList } from '@/components/admin/tickets/TicketList';
import { TicketAssignmentDrawer } from '@/components/admin/tickets/TicketAssignmentDrawer';
import { ticketApi } from '@/lib/api/tickets';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { PerformanceSidebar } from '@/components/admin/performance/PerformanceSidebar';
import { Ticket } from '@/lib/types/ticket';

export default function TicketsPage() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Component is mounted, so we can safely render client-side components
    setIsMounted(true);
  }, []);

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDrawerOpen(true);
  };

  const handleAssignmentComplete = () => {
    // Invalidate the tickets query to refresh the list
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedTicket(null);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage all service tickets in the system
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/app/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Ticket
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <TicketList onTicketSelect={handleTicketSelect} />
        </div>
        <div className="lg:col-span-1">
          {isMounted && <PerformanceSidebar technicianId={selectedTicket?.assigned_technician_id || undefined} />}
        </div>
      </div>

      <TicketAssignmentDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        ticket={selectedTicket}
        onAssignmentComplete={handleAssignmentComplete}
      />
    </div>
  );
}