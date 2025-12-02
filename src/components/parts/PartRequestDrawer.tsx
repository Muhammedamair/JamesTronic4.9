// PartRequestDrawer component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/PartRequestDrawer.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { PartRequest, NewPartRequest, partsApi } from '@/lib/api/parts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PartRequestDrawerProps {
  request?: PartRequest | null;
  onClose: () => void;
  onSave: () => void;
}

export const PartRequestDrawer: React.FC<PartRequestDrawerProps> = ({
  request,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<NewPartRequest> & { status?: string }>({
    ticket_id: '',
    part_id: '',
    quantity: 1,
    request_reason: '',
    urgency_level: 'normal',
    notes: '',
    status: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (request) {
      setFormData({
        ticket_id: request.ticket_id,
        part_id: request.part_id,
        quantity: request.quantity,
        request_reason: request.request_reason || '',
        urgency_level: request.urgency_level,
        notes: request.notes || '',
      });
      setIsEditing(true);
    } else {
      setFormData({
        ticket_id: '',
        part_id: '',
        quantity: 1,
        request_reason: '',
        urgency_level: 'normal',
        notes: '',
      });
      setIsEditing(false);
    }
  }, [request]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditing && request) {
        // For editing, we can only update certain fields (like notes)
        const updatedRequest = await partsApi.partRequests.update(request.id, {
          notes: formData.notes,
          status: formData.status as any, // Allow status change if needed
        });
        console.log('Updated request:', updatedRequest);
      } else {
        // Validate required fields for new request
        if (!formData.ticket_id || !formData.part_id) {
          throw new Error('Ticket ID and Part ID are required');
        }

        const newRequest = await partsApi.partRequests.create({
          ticket_id: formData.ticket_id,
          part_id: formData.part_id,
          quantity: formData.quantity || 1,
          request_reason: formData.request_reason,
          urgency_level: formData.urgency_level || 'normal',
          notes: formData.notes,
        });
        console.log('Created request:', newRequest);
      }

      onSave();
    } catch (err: any) {
      console.error('Error saving part request:', err);
      setError(err.message || 'Failed to save part request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Part Request' : 'Create Part Request'}</CardTitle>
        <CardDescription>
          {isEditing
            ? 'Update the part request details'
            : 'Create a new part request for a ticket'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} id="part-request-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="ticket_id">Ticket ID</Label>
              <Input
                id="ticket_id"
                name="ticket_id"
                value={formData.ticket_id || ''}
                onChange={handleChange}
                placeholder="Enter ticket ID"
                disabled={isEditing}
                required={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part_id">Part ID</Label>
              <Input
                id="part_id"
                name="part_id"
                value={formData.part_id || ''}
                onChange={handleChange}
                placeholder="Enter part ID"
                disabled={isEditing}
                required={!isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                value={formData.quantity || 1}
                onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency_level">Urgency Level</Label>
              <Select
                value={formData.urgency_level || 'normal'}
                onValueChange={(value) => handleSelectChange('urgency_level', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <Label htmlFor="request_reason">Request Reason</Label>
            <Textarea
              id="request_reason"
              name="request_reason"
              value={formData.request_reason || ''}
              onChange={handleChange}
              placeholder="Describe why this part is needed"
              rows={3}
            />
          </div>

          <div className="space-y-2 mb-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Additional notes"
              rows={3}
            />
          </div>

          {isEditing && (
            <div className="space-y-4">
              <Separator />
              <div>
                <h3 className="text-lg font-medium mb-2">Request Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={
                      request?.status === 'pending' ? 'secondary' :
                      request?.status === 'approved' ? 'default' :
                      request?.status === 'rejected' ? 'destructive' :
                      request?.status === 'fulfilled' ? 'secondary' : 'outline'
                    }>
                      {request?.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created At</p>
                    <p>{request?.created_at ? new Date(request.created_at).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Requested By</p>
                    <p>{request?.requested_by.substring(0, 8)}...</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved By</p>
                    <p>{request?.approver_id ? request.approver_id.substring(0, 8) + '...' : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form="part-request-form"
          disabled={loading}
        >
          {loading ? 'Saving...' : isEditing ? 'Update Request' : 'Create Request'}
        </Button>
      </CardFooter>
    </Card>
  );
};