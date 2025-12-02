// POGenerator component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/POGenerator.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { SupplierPO, NewSupplierPO, partsApi, Supplier, PartRequest } from '@/lib/api/parts';
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
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface POGeneratorProps {
  po?: SupplierPO | null;
  onClose: () => void;
  onSave: () => void;
}

export const POGenerator: React.FC<POGeneratorProps> = ({
  po,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<NewSupplierPO>>({
    po_number: '',
    supplier_id: '',
    total_amount: 0,
    expected_delivery_date: '',
    currency: 'USD',
    shipping_cost: 0,
    tax_amount: 0,
    discount_amount: 0,
    notes: '',
    tracking_number: '',
    carrier_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partRequests, setPartRequests] = useState<PartRequest[]>([]);

  useEffect(() => {
    if (po) {
      setFormData({
        po_number: po.po_number,
        supplier_id: po.supplier_id,
        total_amount: po.total_amount,
        expected_delivery_date: po.expected_delivery_date || '',
        currency: po.currency,
        shipping_cost: po.shipping_cost,
        tax_amount: po.tax_amount,
        discount_amount: po.discount_amount,
        notes: po.notes || '',
        tracking_number: po.tracking_number || '',
        carrier_name: po.carrier_name || '',
      });
      setIsEditing(true);
    } else {
      setFormData({
        po_number: '',
        supplier_id: '',
        total_amount: 0,
        expected_delivery_date: '',
        currency: 'USD',
        shipping_cost: 0,
        tax_amount: 0,
        discount_amount: 0,
        notes: '',
        tracking_number: '',
        carrier_name: '',
      });
      setIsEditing(false);
    }

    loadSuppliers();
    loadPartRequests();
  }, [po]);

  const loadSuppliers = async () => {
    try {
      const suppliersList = await partsApi.suppliers.fetchAll();
      setSuppliers(suppliersList);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      setError('Failed to load suppliers');
    }
  };

  const loadPartRequests = async () => {
    try {
      const requests = await partsApi.partRequests.fetchAll();
      setPartRequests(requests);
    } catch (error) {
      console.error('Error loading part requests:', error);
      setError('Failed to load part requests');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'total_amount' || name === 'shipping_cost' || name === 'tax_amount' || name === 'discount_amount'
        ? parseFloat(value) || 0
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
      if (isEditing && po) {
        // Update existing PO
        const updatedPO = await partsApi.purchaseOrders.update(po.id, {
          po_number: formData.po_number || '',
          supplier_id: formData.supplier_id || '',
          total_amount: formData.total_amount || 0,
          expected_delivery_date: formData.expected_delivery_date || null,
          currency: formData.currency || 'USD',
          shipping_cost: formData.shipping_cost || 0,
          tax_amount: formData.tax_amount || 0,
          discount_amount: formData.discount_amount || 0,
          notes: formData.notes,
          tracking_number: formData.tracking_number,
          carrier_name: formData.carrier_name,
        });
        console.log('Updated PO:', updatedPO);
      } else {
        // Validate required fields for new PO
        if (!formData.po_number || !formData.supplier_id) {
          throw new Error('PO Number and Supplier ID are required');
        }

        const newPO = await partsApi.purchaseOrders.create({
          po_number: formData.po_number,
          supplier_id: formData.supplier_id,
          total_amount: formData.total_amount || 0,
          expected_delivery_date: formData.expected_delivery_date,
          currency: formData.currency || 'USD',
          shipping_cost: formData.shipping_cost || 0,
          tax_amount: formData.tax_amount || 0,
          discount_amount: formData.discount_amount || 0,
          notes: formData.notes,
          tracking_number: formData.tracking_number,
          carrier_name: formData.carrier_name,
        });
        console.log('Created PO:', newPO);
      }

      onSave();
    } catch (err: any) {
      console.error('Error saving PO:', err);
      setError(err.message || 'Failed to save purchase order');
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (id: string) => {
    const supplier = suppliers.find(s => s.id === id);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Purchase Order' : 'Create Purchase Order'}</CardTitle>
        <CardDescription>
          {isEditing
            ? 'Update the purchase order details'
            : 'Create a new purchase order for parts'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} id="po-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="po_number">PO Number</Label>
              <Input
                id="po_number"
                name="po_number"
                value={formData.po_number || ''}
                onChange={handleChange}
                placeholder="Enter PO number"
                required={!isEditing}
                disabled={isEditing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier</Label>
              <Select
                value={formData.supplier_id || ''}
                onValueChange={(value) => handleSelectChange('supplier_id', value)}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount</Label>
              <Input
                id="total_amount"
                name="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount || 0}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expected_delivery_date">Expected Delivery</Label>
              <Input
                id="expected_delivery_date"
                name="expected_delivery_date"
                type="date"
                value={formData.expected_delivery_date?.substring(0, 10) || ''}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency || 'USD'}
                onValueChange={(value) => handleSelectChange('currency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tracking_number">Tracking Number</Label>
              <Input
                id="tracking_number"
                name="tracking_number"
                value={formData.tracking_number || ''}
                onChange={handleChange}
                placeholder="Enter tracking number"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="shipping_cost">Shipping Cost</Label>
              <Input
                id="shipping_cost"
                name="shipping_cost"
                type="number"
                step="0.01"
                value={formData.shipping_cost || 0}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_amount">Tax Amount</Label>
              <Input
                id="tax_amount"
                name="tax_amount"
                type="number"
                step="0.01"
                value={formData.tax_amount || 0}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount_amount">Discount Amount</Label>
              <Input
                id="discount_amount"
                name="discount_amount"
                type="number"
                step="0.01"
                value={formData.discount_amount || 0}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="carrier_name">Carrier Name</Label>
              <Input
                id="carrier_name"
                name="carrier_name"
                value={formData.carrier_name || ''}
                onChange={handleChange}
                placeholder="Enter carrier name"
              />
            </div>
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

          {isEditing && po && (
            <div className="space-y-4">
              <Separator />
              <div>
                <h3 className="text-lg font-medium mb-2">PO Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={
                      po.status === 'draft' ? 'secondary' :
                      po.status === 'pending_approval' ? 'default' :
                      po.status === 'approved' ? 'default' :
                      po.status === 'rejected' ? 'destructive' :
                      po.status === 'sent' ? 'outline' :
                      po.status === 'in_transit' ? 'secondary' :
                      po.status === 'delivered' ? 'default' : 'default'
                    }>
                      {po.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Supplier</p>
                    <p>{getSupplierName(po.supplier_id)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created At</p>
                    <p>{po.created_at ? new Date(po.created_at).toLocaleString() : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Requested By</p>
                    <p>{po.requested_by.substring(0, 8)}...</p>
                  </div>
                  {po.approved_by && (
                    <div>
                      <p className="text-muted-foreground">Approved By</p>
                      <p>{po.approved_by.substring(0, 8)}...</p>
                    </div>
                  )}
                  {po.approved_at && (
                    <div>
                      <p className="text-muted-foreground">Approved At</p>
                      <p>{new Date(po.approved_at).toLocaleString()}</p>
                    </div>
                  )}
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
          form="po-form"
          disabled={loading}
        >
          {loading ? 'Saving...' : isEditing ? 'Update PO' : 'Create PO'}
        </Button>
      </CardFooter>
    </Card>
  );
};