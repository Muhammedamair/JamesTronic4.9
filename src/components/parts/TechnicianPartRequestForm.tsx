// TechnicianPartRequestForm component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/TechnicianPartRequestForm.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { NewPartRequest, partsApi, PartsCatalog, PartRequest } from '@/lib/api/parts';
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
import { useToast } from '@/components/ui/use-toast';

interface TechnicianPartRequestFormProps {
  ticketId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TechnicianPartRequestForm: React.FC<TechnicianPartRequestFormProps> = ({
  ticketId,
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<Partial<NewPartRequest>>({
    ticket_id: ticketId || '',
    part_id: '',
    quantity: 1,
    request_reason: '',
    urgency_level: 'normal',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partsCatalog, setPartsCatalog] = useState<PartsCatalog[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadPartsCatalog();
  }, []);

  const loadPartsCatalog = async () => {
    try {
      // This will need the parts catalog API endpoint to be implemented
      // For now, using a placeholder until we create the actual endpoint
      const response = await fetch('/api/parts/catalog');

      if (response.ok) {
        const data = await response.json();
        setPartsCatalog(data);
      } else {
        // For demo purposes, create some mock data
        setPartsCatalog([
          {
            id: 'demo-1',
            part_number: 'DISP-001',
            name: 'Screen Display',
            description: 'Generic smartphone screen display',
            category: 'Display',
            brand: 'Generic',
            model_specific: false,
            cost_price: 150,
            selling_price: 200,
            stock_quantity: 10,
            min_stock_level: 5,
            supplier_id: null,
            compatible_devices: ['iPhone 12', 'iPhone 13'],
            specifications: { size: '6.1 inch', resolution: '2532x1170' },
            image_url: null,
            is_active: true,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'demo-2',
            part_number: 'BATT-001',
            name: 'Battery',
            description: 'High capacity battery replacement',
            category: 'Battery',
            brand: 'Generic',
            model_specific: false,
            cost_price: 30,
            selling_price: 50,
            stock_quantity: 25,
            min_stock_level: 5,
            supplier_id: null,
            compatible_devices: ['iPhone 12', 'iPhone 13'],
            specifications: { capacity: '3000mAh' },
            image_url: null,
            is_active: true,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading parts catalog:', error);
      setError('Failed to load parts catalog');
      // Set demo data as fallback
      setPartsCatalog([
        {
          id: 'demo-1',
          part_number: 'DISP-001',
          name: 'Screen Display',
          description: 'Generic smartphone screen display',
          category: 'Display',
          brand: 'Generic',
          model_specific: false,
          cost_price: 150,
          selling_price: 200,
          stock_quantity: 10,
          min_stock_level: 5,
          supplier_id: null,
          compatible_devices: ['iPhone 12', 'iPhone 13'],
          specifications: { size: '6.1 inch', resolution: '2532x1170' },
          image_url: null,
          is_active: true,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'demo-2',
          part_number: 'BATT-001',
          name: 'Battery',
          description: 'High capacity battery replacement',
          category: 'Battery',
          brand: 'Generic',
          model_specific: false,
          cost_price: 30,
          selling_price: 50,
          stock_quantity: 25,
          min_stock_level: 5,
          supplier_id: null,
          compatible_devices: ['iPhone 12', 'iPhone 13'],
          specifications: { capacity: '3000mAh' },
          image_url: null,
          is_active: true,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 1 : value,
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
      // Validate required fields
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

      toast({
        title: 'Success',
        description: 'Part request submitted successfully',
      });

      setFormData({
        ticket_id: ticketId || '',
        part_id: '',
        quantity: 1,
        request_reason: '',
        urgency_level: 'normal',
        notes: '',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error submitting part request:', err);
      setError(err.message || 'Failed to submit part request');
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit part request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getPartName = (id: string) => {
    const part = partsCatalog.find(p => p.id === id);
    return part ? `${part.name} (${part.part_number})` : 'Select part';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Request Parts</CardTitle>
        <CardDescription>
          Submit a request for parts needed to complete this ticket
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} id="technician-part-request-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="ticket_id">Ticket ID</Label>
              <Input
                id="ticket_id"
                name="ticket_id"
                value={formData.ticket_id || ''}
                onChange={handleChange}
                placeholder="Enter ticket ID"
                required
                disabled={!!ticketId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="part_id">Part</Label>
              <Select
                value={formData.part_id || ''}
                onValueChange={(value) => handleSelectChange('part_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  {partsCatalog.map(part => (
                    <SelectItem key={part.id} value={part.id}>
                      {getPartName(part.id)} - Stock: {part.stock_quantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                max={100} // Prevents too large orders
                value={formData.quantity || 1}
                onChange={handleChange}
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
              required
            />
          </div>

          <div className="space-y-2 mb-4">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={handleChange}
              placeholder="Any additional information for the parts team"
              rows={2}
            />
          </div>

          <div className="space-y-4">
            <Separator />
            <div className="text-sm text-muted-foreground">
              <p>• All fields are required unless otherwise specified</p>
              <p>• Requests will be reviewed by the admin team</p>
              <p>• Critical urgency requests will be prioritized</p>
            </div>
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          form="technician-part-request-form"
          disabled={loading || !formData.part_id || !formData.request_reason}
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </CardFooter>
    </Card>
  );
};