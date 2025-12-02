// PartRequestList component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/PartRequestList.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { PartRequest, partsApi } from '@/lib/api/parts';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { PartRequestDrawer } from './PartRequestDrawer';

interface PartRequestListProps {
  ticketId?: string;
  statusFilter?: string;
  onStatusChange?: (status: string) => void;
}

export const PartRequestList: React.FC<PartRequestListProps> = ({
  ticketId,
  statusFilter = 'all',
  onStatusChange
}) => {
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PartRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    loadPartRequests();
  }, [ticketId, statusFilter]);

  const loadPartRequests = async () => {
    try {
      setLoading(true);
      const requests = await partsApi.partRequests.fetchAll(
        ticketId,
        statusFilter === 'all' ? undefined : statusFilter,
        undefined,
        'created_at',
        'desc'
      );
      setPartRequests(requests);
    } catch (error) {
      console.error('Error loading part requests:', error);
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Part Requests</CardTitle>
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
        <div className="flex justify-between items-center">
          <CardTitle>Part Requests</CardTitle>
          <Button
            onClick={() => {
              setSelectedRequest(null);
              setIsDrawerOpen(true);
            }}
          >
            New Request
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO/Ticket</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Request Reason</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
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
                      Request #{request.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {request.request_reason || '-'}
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
                      {request.requested_by.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleString()}
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
            <DialogTitle>
              {selectedRequest ? 'Part Request Details' : 'Create New Part Request'}
            </DialogTitle>
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