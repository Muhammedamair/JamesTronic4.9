import { z } from 'zod';

// Define Zod schemas for validation
const partsCatalogSchema = z.object({
  id: z.string().uuid(),
  part_number: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  model_specific: z.boolean().default(false),
  cost_price: z.number().nullable(),
  selling_price: z.number().nullable(),
  stock_quantity: z.number().default(0),
  min_stock_level: z.number().default(5),
  supplier_id: z.string().uuid().nullable(),
  compatible_devices: z.array(z.any()).nullable(), // jsonb
  specifications: z.record(z.string(), z.any()).nullable(), // jsonb
  image_url: z.string().nullable(),
  is_active: z.boolean().default(true),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const partRequestSchema = z.object({
  id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  part_id: z.string().uuid(),
  quantity: z.number().min(1),
  request_reason: z.string().nullable(),
  urgency_level: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  status: z.enum(['pending', 'approved', 'rejected', 'fulfilled', 'cancelled']).default('pending'),
  approver_id: z.string().uuid().nullable(),
  approved_at: z.string().nullable(),
  rejected_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  fulfilled_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const newPartRequestSchema = z.object({
  ticket_id: z.string().uuid(),
  part_id: z.string().uuid(),
  quantity: z.number().min(1).default(1),
  request_reason: z.string().optional(),
  urgency_level: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  notes: z.string().optional(),
});

const supplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contact_person: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  zip_code: z.string().nullable(),
  tax_id: z.string().nullable(),
  payment_terms: z.string().nullable(),
  delivery_terms: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const newSupplierSchema = z.object({
  name: z.string().min(1),
  contact_person: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zip_code: z.string().optional(),
  tax_id: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_terms: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

const supplierPOSchema = z.object({
  id: z.string().uuid(),
  po_number: z.string(),
  supplier_id: z.string().uuid(),
  requested_by: z.string().uuid(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().nullable(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'in_transit', 'delivered', 'partially_delivered', 'cancelled']).default('draft'),
  expected_delivery_date: z.string().nullable(),
  actual_delivery_date: z.string().nullable(),
  estimated_delivery_eta: z.string().nullable(),
  total_amount: z.number().nonnegative().default(0),
  currency: z.string().default('USD'),
  shipping_cost: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  notes: z.string().nullable(),
  tracking_number: z.string().nullable(),
  carrier_name: z.string().nullable(),
  approval_status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  approval_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const newSupplierPOSchema = z.object({
  po_number: z.string().min(1),
  supplier_id: z.string().uuid(),
  total_amount: z.number().nonnegative(),
  expected_delivery_date: z.string().datetime().optional(),
  currency: z.string().default('USD'),
  shipping_cost: z.number().nonnegative().default(0),
  tax_amount: z.number().nonnegative().default(0),
  discount_amount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
  tracking_number: z.string().optional(),
  carrier_name: z.string().optional(),
});

const partsArrivalSchema = z.object({
  id: z.string().uuid(),
  po_id: z.string().uuid(),
  part_id: z.string().uuid(),
  received_by: z.string().uuid(),
  quantity_received: z.number().int().positive(),
  quantity_ordered: z.number().int().positive(),
  received_at: z.string(),
  status: z.enum(['pending', 'verified', 'rejected', 'damaged']).default('verified'),
  batch_number: z.string().nullable(),
  expiry_date: z.string().nullable(),
  condition_notes: z.string().nullable(),
  damage_report: z.string().nullable(),
  inspection_report: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const newPartsArrivalSchema = z.object({
  po_id: z.string().uuid(),
  part_id: z.string().uuid(),
  quantity_received: z.number().int().positive(),
  quantity_ordered: z.number().int().positive(),
  status: z.enum(['pending', 'verified', 'rejected', 'damaged']).default('verified'),
  batch_number: z.string().optional(),
  expiry_date: z.string().datetime().optional(),
  condition_notes: z.string().optional(),
  damage_report: z.string().optional(),
  inspection_report: z.string().optional(),
});

// Type definitions
export type PartsCatalog = z.infer<typeof partsCatalogSchema>;
export type PartRequest = z.infer<typeof partRequestSchema>;
export type NewPartRequest = z.infer<typeof newPartRequestSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type NewSupplier = z.infer<typeof newSupplierSchema>;
export type SupplierPO = z.infer<typeof supplierPOSchema>;
export type NewSupplierPO = z.infer<typeof newSupplierPOSchema>;
export type PartsArrival = z.infer<typeof partsArrivalSchema>;
export type NewPartsArrival = z.infer<typeof newPartsArrivalSchema>;

// API wrapper for parts system
export const partsApi = {
  // Part Requests API
  partRequests: {
    // Fetch all part requests
    fetchAll: async (
      ticketId?: string,
      status?: string,
      requestedBy?: string,
      sortBy: string = 'created_at',
      order: 'asc' | 'desc' = 'desc',
      limit: number = 20,
      offset: number = 0
    ): Promise<PartRequest[]> => {
      try {
        let url = `/api/parts/requests?sort=${sortBy}&order=${order}&limit=${limit}&offset=${offset}`;

        if (ticketId) url += `&ticket_id=${ticketId}`;
        if (status) url += `&status=${status}`;
        if (requestedBy) url += `&requested_by=${requestedBy}`;

        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access part requests');
          }
          throw new Error(`Failed to fetch part requests: ${response.statusText}`);
        }

        const data = await response.json();
        return data.map((item: any) => partRequestSchema.parse(item));
      } catch (error) {
        console.error('Error fetching part requests:', error);
        throw error;
      }
    },

    // Fetch part request by ID
    fetchById: async (id: string): Promise<PartRequest> => {
      try {
        const response = await fetch(`/api/parts/requests/${id}`);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access part request');
          }
          if (response.status === 404) {
            throw new Error('Part request not found');
          }
          throw new Error(`Failed to fetch part request: ${response.statusText}`);
        }

        const data = await response.json();
        return partRequestSchema.parse(data);
      } catch (error) {
        console.error('Error fetching part request by ID:', error);
        throw error;
      }
    },

    // Create a new part request
    create: async (partData: NewPartRequest): Promise<PartRequest> => {
      try {
        // Validate input with Zod
        const validatedInput = newPartRequestSchema.parse(partData);

        const response = await fetch('/api/parts/requests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validatedInput),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to create part request');
          }
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
          }
          throw new Error(`Failed to create part request: ${response.statusText}`);
        }

        const data = await response.json();
        return partRequestSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Zod validation error in create part request:', error.issues);
          throw new Error('Input validation failed');
        }
        console.error('Error creating part request:', error);
        throw error;
      }
    },

    // Update a part request
    update: async (id: string, updates: Partial<PartRequest>): Promise<PartRequest> => {
      try {
        const response = await fetch(`/api/parts/requests/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to update part request');
          }
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
          }
          if (response.status === 404) {
            throw new Error('Part request not found');
          }
          throw new Error(`Failed to update part request: ${response.statusText}`);
        }

        const data = await response.json();
        return partRequestSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Zod validation error in update part request:', error.issues);
          throw new Error('Input validation failed');
        }
        console.error('Error updating part request:', error);
        throw error;
      }
    },

    // Delete a part request
    delete: async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/parts/requests/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to delete part request');
          }
          if (response.status === 404) {
            throw new Error('Part request not found');
          }
          throw new Error(`Failed to delete part request: ${response.statusText}`);
        }

        return true;
      } catch (error) {
        console.error('Error deleting part request:', error);
        throw error;
      }
    },
  },

  // Suppliers API
  suppliers: {
    // Fetch all suppliers
    fetchAll: async (
      isActive?: boolean,
      sortBy: string = 'name',
      order: 'asc' | 'desc' = 'asc',
      limit: number = 20,
      offset: number = 0
    ): Promise<Supplier[]> => {
      try {
        let url = `/api/parts/supplier?sort=${sortBy}&order=${order}&limit=${limit}&offset=${offset}`;

        if (typeof isActive !== 'undefined') url += `&active=${isActive}`;

        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access suppliers');
          }
          throw new Error(`Failed to fetch suppliers: ${response.statusText}`);
        }

        const data = await response.json();
        return data.map((item: any) => supplierSchema.parse(item));
      } catch (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
    },

    // Create a new supplier
    create: async (supplierData: NewSupplier): Promise<Supplier> => {
      try {
        // Validate input with Zod
        const validatedInput = newSupplierSchema.parse(supplierData);

        const response = await fetch('/api/parts/supplier', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validatedInput),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to create supplier');
          }
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
          }
          throw new Error(`Failed to create supplier: ${response.statusText}`);
        }

        const data = await response.json();
        return supplierSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Zod validation error in create supplier:', error.issues);
          throw new Error('Input validation failed');
        }
        console.error('Error creating supplier:', error);
        throw error;
      }
    },
  },

  // Purchase Orders API
  purchaseOrders: {
    // Fetch all purchase orders
    fetchAll: async (
      supplierId?: string,
      status?: string,
      requestedBy?: string,
      sortBy: string = 'created_at',
      order: 'asc' | 'desc' = 'desc',
      limit: number = 20,
      offset: number = 0
    ): Promise<SupplierPO[]> => {
      try {
        let url = `/api/parts/po?sort=${sortBy}&order=${order}&limit=${limit}&offset=${offset}`;

        if (supplierId) url += `&supplier_id=${supplierId}`;
        if (status) url += `&status=${status}`;
        if (requestedBy) url += `&requested_by=${requestedBy}`;

        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access purchase orders');
          }
          throw new Error(`Failed to fetch purchase orders: ${response.statusText}`);
        }

        const data = await response.json();
        return data.map((item: any) => supplierPOSchema.parse(item));
      } catch (error) {
        console.error('Error fetching purchase orders:', error);
        throw error;
      }
    },

    // Fetch purchase order by ID
    fetchById: async (id: string): Promise<SupplierPO> => {
      try {
        const response = await fetch(`/api/parts/po/${id}`);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access purchase order');
          }
          if (response.status === 404) {
            throw new Error('Purchase order not found');
          }
          throw new Error(`Failed to fetch purchase order: ${response.statusText}`);
        }

        const data = await response.json();
        return supplierPOSchema.parse(data);
      } catch (error) {
        console.error('Error fetching purchase order by ID:', error);
        throw error;
      }
    },

    // Create a new purchase order
    create: async (poData: NewSupplierPO): Promise<SupplierPO> => {
      try {
        // Validate input with Zod
        const validatedInput = newSupplierPOSchema.parse(poData);

        const response = await fetch('/api/parts/po', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validatedInput),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to create purchase order');
          }
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
          }
          throw new Error(`Failed to create purchase order: ${response.statusText}`);
        }

        const data = await response.json();
        return supplierPOSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Zod validation error in create purchase order:', error.issues);
          throw new Error('Input validation failed');
        }
        console.error('Error creating purchase order:', error);
        throw error;
      }
    },

    // Update a purchase order
    update: async (id: string, updates: Partial<SupplierPO>): Promise<SupplierPO> => {
      try {
        const response = await fetch(`/api/parts/po/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to update purchase order');
          }
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
          }
          if (response.status === 404) {
            throw new Error('Purchase order not found');
          }
          throw new Error(`Failed to update purchase order: ${response.statusText}`);
        }

        const data = await response.json();
        return supplierPOSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Zod validation error in update purchase order:', error.issues);
          throw new Error('Input validation failed');
        }
        console.error('Error updating purchase order:', error);
        throw error;
      }
    },
  },

  // Parts Arrivals API
  partsArrivals: {
    // Fetch all parts arrivals
    fetchAll: async (
      poId?: string,
      partId?: string,
      status?: string,
      receivedBy?: string,
      sortBy: string = 'received_at',
      order: 'asc' | 'desc' = 'desc',
      limit: number = 20,
      offset: number = 0
    ): Promise<PartsArrival[]> => {
      try {
        let url = `/api/parts/arrival?sort=${sortBy}&order=${order}&limit=${limit}&offset=${offset}`;

        if (poId) url += `&po_id=${poId}`;
        if (partId) url += `&part_id=${partId}`;
        if (status) url += `&status=${status}`;
        if (receivedBy) url += `&received_by=${receivedBy}`;

        const response = await fetch(url);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to access parts arrivals');
          }
          throw new Error(`Failed to fetch parts arrivals: ${response.statusText}`);
        }

        const data = await response.json();
        return data.map((item: any) => partsArrivalSchema.parse(item));
      } catch (error) {
        console.error('Error fetching parts arrivals:', error);
        throw error;
      }
    },

    // Create a new parts arrival
    create: async (arrivalData: NewPartsArrival): Promise<PartsArrival> => {
      try {
        // Validate input with Zod
        const validatedInput = newPartsArrivalSchema.parse(arrivalData);

        const response = await fetch('/api/parts/arrival', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validatedInput),
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Unauthorized: Please log in to record parts arrival');
          }
          if (response.status === 400) {
            const errorData = await response.json();
            throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
          }
          throw new Error(`Failed to record parts arrival: ${response.statusText}`);
        }

        const data = await response.json();
        return partsArrivalSchema.parse(data);
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Zod validation error in create parts arrival:', error.issues);
          throw new Error('Input validation failed');
        }
        console.error('Error recording parts arrival:', error);
        throw error;
      }
    },
  },

  // Parts Catalog API
  partsCatalog: {
    // Fetch all parts in catalog
    fetchAll: async (
      category?: string,
      brand?: string,
      isActive: boolean = true,
      sortBy: string = 'name',
      order: 'asc' | 'desc' = 'asc',
      limit: number = 20,
      offset: number = 0
    ): Promise<PartsCatalog[]> => {
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
        // Note: We'll need to create the API endpoint for parts catalog separately
        // For now, this is just an example of how the API would look
        return data.map((item: any) => partsCatalogSchema.parse(item));
      } catch (error) {
        console.error('Error fetching parts catalog:', error);
        throw error;
      }
    },
  },
};