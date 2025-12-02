// TechnicianPartsStatus component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/TechnicianPartsStatus.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { PartRequest, partsApi } from '@/lib/api/parts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { PartRequestDrawer } from './PartRequestDrawer';
import { useToast } from '@/hooks/use-toast';

interface TechnicianPartsStatusProps {
  technicianId: string;
  ticketId?: string;
}

export const TechnicianPartsStatus: React.FC<TechnicianPartsStatusProps> = ({
  technicianId,
  ticketId,
}) => {
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PartRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadPartRequests();
  }, [technicianId, ticketId, statusFilter]);

  const loadPartRequests = async () => {
    try {
      setLoading(true);

      // Since the API doesn't directly expose requests by technician,
      // we'll fetch all requests and filter on the frontend
      // In a real implementation, we'd have an API endpoint that fetches
      // requests for tickets assigned to this technician
      let allRequests = await partsApi.partRequests.fetchAll(
        ticketId,
        statusFilter === 'all' ? undefined : statusFilter,
        undefined,
        'created_at',
        'desc'
      );

      // For now, we'll just show all requests
      // In a real implementation, we'd filter by tickets assigned to the technician
      setPartRequests(allRequests);
    } catch (error) {
      console.error('Error loading part requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load part requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (request: PartRequest) => {
    setSelectedRequest(request);
    setIsDrawerOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'fulfilled':
        return 'default'; // Changed from 'success' to 'default' since 'success' variant doesn't exist
      case 'cancelled':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getUrgencyBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'normal':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusCount = (status: string) => {
    return partRequests.filter(req => req.status === status).length;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Parts Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Parts Status</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All <Badge variant="secondary" className="ml-2">{partRequests.length}</Badge>
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
            >
              Pending <Badge variant="secondary" className="ml-2">{getStatusCount('pending')}</Badge>
            </Button>
            <Button
              variant={statusFilter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('approved')}
            >
              Approved <Badge variant="secondary" className="ml-2">{getStatusCount('approved')}</Badge>
            </Button>
            <Button
              variant={statusFilter === 'fulfilled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('fulfilled')}
            >
              Fulfilled <Badge variant="secondary" className="ml-2">{getStatusCount('fulfilled')}</Badge>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Request Reason</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No part requests found
                  </TableCell>
                </TableRow>
              ) : (
                partRequests.map((request) => (
                  <TableRow
                    key={request.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(request)}
                  >
                    <TableCell className="font-medium">
                      {request.ticket_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {request.part_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {request.request_reason?.substring(0, 20) || '-'}...
                    </TableCell>
                    <TableCell>
                      {request.quantity}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getUrgencyBadgeVariant(request.urgency_level)}>
                        {request.urgency_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Part Request Details</DialogTitle>
          </DialogHeader>
          <PartRequestDrawer
            request={selectedRequest}
            onClose={() => {
              setIsDrawerOpen(false);
              setTimeout(() => {
                setSelectedRequest(null);
              }, 300); // Delay to allow animation to complete
            }}
            onSave={() => {
              loadPartRequests(); // Refresh the list after saving
              setIsDrawerOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
};