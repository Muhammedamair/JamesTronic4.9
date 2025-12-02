'use client';

import React, { useState, useEffect } from 'react';
import { TicketCard } from '@/components/admin/tickets/TicketCard';
import { SkeletonLoader } from '@/components/admin/shared/SkeletonLoader';
import { ticketApi } from '@/lib/api/tickets';
import { useQuery } from '@tanstack/react-query';
import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ticket } from '@/lib/types/ticket';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TicketListProps {
  onTicketSelect: (ticket: Ticket) => void;
}

export const TicketList: React.FC<TicketListProps> = ({ onTicketSelect }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'unassigned' | 'assigned'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: tickets = [],
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const allTickets = await ticketApi.fetchAll();
      return allTickets;
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Filter and search tickets
  const filteredTickets = tickets.filter(ticket => {
    // Apply status filter
    if (filter === 'pending' && ticket.status.toLowerCase() !== 'pending') {
      return false;
    }
    if (filter === 'unassigned' && ticket.assigned_technician_id !== null) {
      return false;
    }
    if (filter === 'assigned' && ticket.assigned_technician_id === null) {
      return false;
    }

    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        ticket.customer?.name?.toLowerCase().includes(searchLower) ||
        ticket.issue_summary?.toLowerCase().includes(searchLower) ||
        ticket.device_category.toLowerCase().includes(searchLower) ||
        ticket.id.toLowerCase().includes(searchLower);

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader variant="line" count={5} className="h-24" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Failed to load tickets. Please try again.</p>
        <Button onClick={() => refetch()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (filteredTickets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {tickets.length === 0 ? 'No tickets available' : 'No tickets match your filters'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => refetch()}>
            <Filter className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Ticket Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTickets.map(ticket => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketSelect(ticket)}
          />
        ))}
      </div>
    </div>
  );
};