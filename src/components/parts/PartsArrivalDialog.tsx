// PartsArrivalDialog component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/PartsArrivalDialog.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { PartsArrival, NewPartsArrival, partsApi, SupplierPO, PartsCatalog } from '@/lib/api/parts';
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

interface PartsArrivalDialogProps {
  arrival?: PartsArrival | null;
  poId?: string;
  partId?: string;
  onClose: () => void;
  onSave: () => void;
}

export const PartsArrivalDialog: React.FC<PartsArrivalDialogProps> = ({
  arrival,
  poId,
  partId,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<NewPartsArrival>>({
    po_id: '',
    part_id: '',
    quantity_received: 1,
    quantity_ordered: 1,
    status: 'verified',
    batch_number: '',
    expiry_date: '',
    condition_notes: '',
    damage_report: '',
    inspection_report: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<SupplierPO[]>([]);
  const [partsCatalog, setPartsCatalog] = useState<PartsCatalog[]>([]);

  useEffect(() => {
    if (arrival) {
      setFormData({
        po_id: arrival.po_id,
        part_id: arrival.part_id,
        quantity_received: arrival.quantity_received,
        quantity_ordered: arrival.quantity_ordered,
        status: arrival.status,
        batch_number: arrival.batch_number || '',
        expiry_date: arrival.expiry_date || '',
        condition_notes: arrival.condition_notes || '',
        damage_report: arrival.damage_report || '',
        inspection_report: arrival.inspection_report || '',
      });
      setIsEditing(true);
    } else {
      setFormData({
        po_id: poId || '',
        part_id: partId || '',
        quantity_received: 1,
        quantity_ordered: 1,
        status: 'verified',
        batch_number: '',
        expiry_date: '',
        condition_notes: '',
        damage_report: '',
        inspection_report: '',
      });
      setIsEditing(false);
    }
    
    loadPurchaseOrders();
    loadPartsCatalog();
  }, [arrival, poId, partId]);

  const loadPurchaseOrders = async () => {
    try {
      const orders = await partsApi.purchaseOrders.fetchAll();
      setPurchaseOrders(orders);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      setError('Failed to load purchase orders');
    }
  };

  const loadPartsCatalog = async () => {
    try {
      const parts = await partsApi.partsCatalog.fetchAll(); // This assumes we have a partsCatalog API
      setPartsCatalog(parts);
    } catch (error) {
      console.error('Error loading parts catalog:', error);
      setError('Failed to load parts catalog');
    }
  };

  // Add the partsCatalog API methods to the partsApi
  const partsCatalogApi = {
    fetchAll: async (
      category?: string,
      brand?: string,
      isActive: boolean = true,
      sortBy: string = 'name',
      order: 'asc' | 'desc' = 'asc',
      limit: number = 20,
      offset: number = 0
    ) => {
      try {
        let url = `/api/parts/catalog?sort=${sortBy}&order=${order}&limit=${limit}&offset=${offset}&active=${isActive}`;

        if (category) url += `&category=${category}`;
        if (brand) url += `&brand=${brand}`;

        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access parts catalog');
          }
          throw new Error(`Failed to fetch parts catalog: ${response.statusText}`);
        }

        const data = await response.json();
        // Since we don't have the schema for partsCatalog yet, we'll return the raw data
        return data;
      } catch (error) {
        console.error('Error fetching parts catalog:', error);
        throw error;
      }
    },
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity_received' || name === 'quantity_ordered' 
        ? parseInt(value) || 1 
        : value,
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
      if (isEditing && arrival) {
        // For now, we're not supporting editing of arrivals
        throw new Error('Editing parts arrivals is not supported');
      } else {
        // Validate required fields for new arrival
        if (!formData.po_id || !formData.part_id) {
          throw new Error('PO ID and Part ID are required');
        }

        const newArrival = await partsApi.partsArrivals.create({
          po_id: formData.po_id,
          part_id: formData.part_id,
          quantity_received: formData.quantity_received || 1,
          quantity_ordered: formData.quantity_ordered || 1,
          status: formData.status || 'verified',
          batch_number: formData.batch_number,
          expiry_date: formData.expiry_date,
          condition_notes: formData.condition_notes,
          damage_report: formData.damage_report,
          inspection_report: formData.inspection_report,
        });
        console.log('Created arrival:', newArrival);
      }
      
      onSave();
    } catch (err: any) {
      console.error('Error saving parts arrival:', err);
      setError(err.message || 'Failed to save parts arrival');
    } finally {
      setLoading(false);
    }
  };

  const getPODetails = (id: string) => {
    const po = purchaseOrders.find(p => p.id === id);
    return po ? `${po.po_number} (${po.supplier_id.substring(0, 8)}...)` : 'Unknown PO';
  };

  const getPartDetails = (id: string) => {
    const part = partsCatalog.find(p => p.id === id);
    return part ? `${part.name} (${part.part_number})` : 'Unknown Part';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditing ? 'Parts Arrival Details' : 'Record Parts Arrival'}</CardTitle>
        <CardDescription>
          {isEditing 
            ? 'View the parts arrival details' 
            : 'Record new parts arrival from supplier'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} id="parts-arrival-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="po_id">Purchase Order</Label>
              <Select 
                value={formData.po_id || ''} 
                onValueChange={(value) => handleSelectChange('po_id', value)}
                disabled={isEditing || !!poId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PO" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map(po => (
                    <SelectItem key={po.id} value={po.id}>
                      {getPODetails(po.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="part_id">Part</Label>
              <Select 
                value={formData.part_id || ''} 
                onValueChange={(value) => handleSelectChange('part_id', value)}
                disabled={isEditing || !!partId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  {partsCatalog.map(part => (
                    <SelectItem key={part.id} value={part.id}>
                      {getPartDetails(part.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity_received">Quantity Received</Label>
              <Input
                id="quantity_received"
                name="quantity_received"
                type="number"
                min="1"
                value={formData.quantity_received || 1}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity_ordered">Quantity Ordered</Label>
              <Input
                id="quantity_ordered"
                name="quantity_ordered"
                type="number"
                min="1"
                value={formData.quantity_ordered || 1}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status || 'verified'} 
                onValueChange={(value) => handleSelectChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="batch_number">Batch Number</Label>
              <Input
                id="batch_number"
                name="batch_number"
                value={formData.batch_number || ''}
                onChange={handleChange}
                placeholder="Enter batch number"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="expiry_date">Expiry Date</Label>
              <Input
                id="expiry_date"
                name="expiry_date"
                type="date"
                value={formData.expiry_date?.substring(0, 10) || ''}
                onChange={handleChange}
              />
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            <Label htmlFor="condition_notes">Condition Notes</Label>
            <Textarea
              id="condition_notes"
              name="condition_notes"
              value={formData.condition_notes || ''}
              onChange={handleChange}
              placeholder="Describe the condition of received parts"
              rows={2}
            />
          </div>
          
          <div className="space-y-2 mb-4">
            <Label htmlFor="damage_report">Damage Report</Label>
            <Textarea
              id="damage_report"
              name="damage_report"
              value={formData.damage_report || ''}
              onChange={handleChange}
              placeholder="Report any damages found"
              rows={2}
            />
          </div>
          
          <div className="space-y-2 mb-4">
            <Label htmlFor="inspection_report">Inspection Report</Label>
            <Textarea
              id="inspection_report"
              name="inspection_report"
              value={formData.inspection_report || ''}
              onChange={handleChange}
              placeholder="Quality inspection notes"
              rows={2}
            />
          </div>
          
          {isEditing && arrival && (
            <div className="space-y-4">
              <Separator />
              <div>
                <h3 className="text-lg font-medium mb-2">Arrival Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={
                      arrival.status === 'pending' ? 'secondary' :
                      arrival.status === 'verified' ? 'default' :
                      arrival.status === 'rejected' ? 'destructive' :
                      arrival.status === 'damaged' ? 'destructive' : 'outline'
                    }>
                      {arrival.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Received At</p>
                    <p>{arrival.received_at ? new Date(arrival.received_at).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Received By</p>
                    <p>{arrival.received_by.substring(0, 8)}...</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PO</p>
                    <p>{getPODetails(arrival.po_id)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Part</p>
                    <p>{getPartDetails(arrival.part_id)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Quantity</p>
                    <p>{arrival.quantity_received} received of {arrival.quantity_ordered} ordered</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        {!isEditing && (
          <Button 
            type="submit" 
            form="parts-arrival-form" 
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Record Arrival'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};