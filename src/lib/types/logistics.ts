import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const TransporterProviderTypeSchema = z.enum([
    'internal', 'external_rapido', 'external_porter', 'external_dunzo', 'external_manual'
]);

export const VehicleTypeSchema = z.enum([
    'motorbike', 'scooter', 'three_wheeler', 'small_van', 'large_van', 'truck'
]);

export const DeliveryStatusSchema = z.enum([
    'pending_assignment', 'assigned', 'pickup_in_progress', 'picked_up',
    'in_transit', 'delivery_attempted', 'delivered', 'cancelled', 'returned'
]);

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

// Transporter Fleet
export const transporterSchema = z.object({
    id: z.string().uuid(),
    driver_id: z.string().uuid().nullable(),
    vehicle_plate: z.string().nullable(),
    vehicle_type: VehicleTypeSchema,
    vehicle_model: z.string().nullable(),
    capacity_kg: z.number().nullable(),
    provider_type: TransporterProviderTypeSchema,
    external_provider_id: z.string().nullable(),
    is_active: z.boolean(),
    current_status: z.string().nullable(),
    reliability_score: z.number(),
    total_deliveries: z.number(),
    created_at: z.string()
});
export type Transporter = z.infer<typeof transporterSchema>;

// Logistics Delivery
export const deliverySchema = z.object({
    id: z.string().uuid(),
    ticket_id: z.string().uuid().nullable(),
    pickup_address: z.string(),
    delivery_address: z.string(),
    items_description: z.string().nullable(),
    items_weight_kg: z.number().nullable(),
    is_fragile: z.boolean(),
    requires_installation: z.boolean(),
    assigned_transporter_id: z.string().uuid().nullable(),
    provider_type: TransporterProviderTypeSchema.nullable(),
    status: DeliveryStatusSchema,
    estimated_cost: z.number().nullable(),
    scheduled_pickup: z.string().nullable(),
    created_at: z.string()
});
export type Delivery = z.infer<typeof deliverySchema>;

// Vehicle Tracking Log
export const trackingLogSchema = z.object({
    id: z.string().uuid(),
    transporter_id: z.string().uuid(),
    speed_kmh: z.number().nullable(),
    battery_level: z.number().nullable(),
    recorded_at: z.string()
});
// note: location is geoJSON in DB, typically need conversion if selecting it
export type TrackingLog = z.infer<typeof trackingLogSchema>;
