// SupplierList component
// /Users/mohammedamair/Downloads/JamesTronic_Prompt_Kit/james-tronic/src/components/parts/SupplierList.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Supplier, partsApi } from '@/lib/api/parts';
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
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SupplierListProps {
  activeOnly?: boolean;
}

export const SupplierList: React.FC<SupplierListProps> = ({ activeOnly = true }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSuppliers();
  }, [activeOnly]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const supplierList = await partsApi.suppliers.fetchAll(activeOnly, 'name', 'asc');
      setSuppliers(supplierList);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsDrawerOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
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
          <CardTitle>Suppliers</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button 
              onClick={() => {
                setSelectedSupplier(null);
                setIsDrawerOpen(true);
              }}
            >
              Add Supplier
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    No suppliers found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <TableRow 
                    key={supplier.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(supplier)}
                  >
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>{supplier.contact_person || '-'}</TableCell>
                    <TableCell>{supplier.email || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>{supplier.city || supplier.state || supplier.country || '-'}</TableCell>
                    <TableCell>
                      {supplier.rating ? (
                        <Badge variant={supplier.rating >= 4 ? 'default' : supplier.rating >= 3 ? 'secondary' : 'destructive'}>
                          {supplier.rating}/5
                        </Badge>
                      ) : (
                        <Badge variant="outline">No rating</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={supplier.is_active ? 'default' : 'destructive'}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      
      <Dialog 
        open={isDrawerOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setIsDrawerOpen(false);
            setTimeout(() => {
              setSelectedSupplier(null);
            }, 300); // Delay to allow animation to complete
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier ? 'Supplier Details' : 'Add New Supplier'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {selectedSupplier ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Supplier Name</h3>
                    <p className="text-lg font-semibold">{selectedSupplier.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                    <Badge variant={selectedSupplier.is_active ? 'default' : 'destructive'}>
                      {selectedSupplier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Contact Person</h3>
                    <p>{selectedSupplier.contact_person || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                    <p>{selectedSupplier.email || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Phone</h3>
                    <p>{selectedSupplier.phone || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Rating</h3>
                    <div className="flex items-center gap-2">
                      {selectedSupplier.rating ? (
                        <>
                          <span className="text-xl font-bold">{selectedSupplier.rating}</span>
                          <span className="text-sm text-muted-foreground">/5</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not rated</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
                  <p>
                    {[
                      selectedSupplier.address,
                      selectedSupplier.city,
                      selectedSupplier.state,
                      selectedSupplier.zip_code,
                      selectedSupplier.country
                    ].filter(Boolean).join(', ') || '-'}
                  </p>
                </div>
                
                {selectedSupplier.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
                    <p>{selectedSupplier.notes}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Tax ID</h3>
                    <p>{selectedSupplier.tax_id || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Payment Terms</h3>
                    <p>{selectedSupplier.payment_terms || '-'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Delivery Terms</h3>
                    <p>{selectedSupplier.delivery_terms || '-'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">Add a new supplier to the system.</p>
                <p className="text-sm text-muted-foreground">
                  Note: The actual supplier creation form would be implemented here. 
                  For now, this is a placeholder showing the supplier details view.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};