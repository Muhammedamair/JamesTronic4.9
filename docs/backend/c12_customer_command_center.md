# C12: Customer Command Center - Implementation Documentation

## Overview
The Customer Command Center (C12) provides a unified interface for customers to track their repair requests, view SLA timelines, receive updates, approve/reject quotations, and stay informed about transporter status. This implementation includes backend schema changes, API routes, and frontend components.

## Architecture

### Data Schema

#### New Tables

**ticket_events**
- `id`: UUID (Primary Key)
- `ticket_id`: UUID (Foreign Key to tickets table)
- `event_type`: TEXT (e.g., 'status_change', 'technician_assigned', 'part_required', 'estimated_completion', 'transporter_assigned')
- `title`: TEXT (Display title for the event)
- `description`: TEXT (Detailed description of the event)
- `details`: JSONB (Structured data about the event)
- `created_by`: UUID (Foreign Key to profiles table, who created this event)
- `created_at`: TIMESTAMPTZ (Timestamp when event was created)
- `metadata`: JSONB (Additional metadata)

**ticket_sla**
- `id`: UUID (Primary Key)
- `ticket_id`: UUID (Foreign Key to tickets table)
- `promised_hours`: INT (Hours promised to customer)
- `start_time`: TIMESTAMPTZ (When SLA started, default now())
- `end_time`: TIMESTAMPTZ (When SLA was completed)
- `breach_time`: TIMESTAMPTZ (When SLA was breached)
- `status`: TEXT (Status: 'active', 'breached', 'fulfilled', 'at_risk')
- `priority`: TEXT (Priority: 'low', 'normal', 'high', 'critical')
- `created_at`: TIMESTAMPTZ (Creation timestamp)
- `updated_at`: TIMESTAMPTZ (Last updated timestamp)

**ticket_quotations**
- `id`: UUID (Primary Key)
- `ticket_id`: UUID (Foreign Key to tickets table)
- `quoted_price`: DECIMAL(10, 2) (Quoted price)
- `quoted_parts_cost`: DECIMAL(10, 2) (Cost of parts if applicable)
- `quoted_labor_cost`: DECIMAL(10, 2) (Labor cost if applicable)
- `quote_notes`: TEXT (Additional notes about the quote)
- `created_by`: UUID (Foreign Key to profiles table, who created this quote)
- `created_at`: TIMESTAMPTZ (Creation timestamp)
- `approved_at`: TIMESTAMPTZ (When customer approved)
- `rejected_at`: TIMESTAMPTZ (When customer rejected)
- `approved_by_customer`: BOOLEAN (Whether customer approved/rejected)
- `expires_at`: TIMESTAMPTZ (When the quote expires)
- `status`: TEXT (Status: 'pending', 'approved', 'rejected', 'expired', 'fulfilled')

#### Extended Tables

**tickets table additions:**
- `transporter_job_id`: TEXT (Reference to transporter job)
- `pickup_scheduled_at`: TIMESTAMPTZ (Scheduled pickup time)
- `pickup_completed_at`: TIMESTAMPTZ (Completed pickup time)
- `drop_scheduled_at`: TIMESTAMPTZ (Scheduled drop time)
- `drop_completed_at`: TIMESTAMPTZ (Completed drop time)
- `transporter_tracking_url`: TEXT (URL for tracking transporter)
- `transporter_contact_name`: TEXT (Name of transporter contact)
- `transporter_contact_phone`: TEXT (Phone of transporter contact)
- `current_quotation_id`: UUID (Foreign Key to ticket_quotations)
- `sla_id`: UUID (Foreign Key to ticket_sla)

**customers table additions:**
- `notification_preferences`: JSONB (Customer notification preferences, default: {"sms": true, "whatsapp": true, "push": true})
- `preferred_language`: TEXT (Customer preferred language, options: 'en', 'hi', 'te')

### Security & RLS Policies

The implementation includes comprehensive Row Level Security (RLS) policies:

- Customers can only view events, SLAs, and quotations for their own tickets
- Technicians can view events, SLAs, and quotations for assigned tickets
- Admins and staff can view all records
- Customers can approve/reject their own quotations
- All access is validated through the existing role system

### API Routes

**POST /api/customer/quotations/approve**
- Authenticates customer via OTP token
- Verifies customer owns the ticket
- Updates quotation status to 'approved'
- Updates ticket status to 'in_progress'
- Adds event to timeline

**POST /api/customer/quotations/reject**
- Authenticates customer via OTP token
- Verifies customer owns the ticket
- Updates quotation status to 'rejected'
- Adds event to timeline

**GET /api/customer/timeline/[ticket_id]**
- Authenticates customer via OTP token
- Verifies customer owns the ticket
- Returns timeline events from ticket_events table
- Falls back to status history if no events exist

**GET /api/customer/timeline**
- Authenticates customer via OTP token
- Returns timeline events for all customer tickets

## Frontend Components

### CustomerDashboard
The main dashboard component that includes:
- Customer greeting and personalization
- Network status detection with offline indicator
- Responsive grid layout for key information cards
- Tabbed interface for different views (Timeline, My Repairs, Notifications)

### TicketTimeline
- Displays chronological events for a ticket
- Shows event types with appropriate icons
- Includes skeleton loading states
- Handles offline scenarios gracefully

### QuotationCard
- Displays quotation details (price, notes, status)
- Approve/reject buttons with loading states
- Network status awareness
- Toast notifications for user feedback

### SLACountdown
- Displays SLA status with appropriate badges
- Shows time remaining for repairs
- Handles different SLA states (active, breached, at risk, fulfilled)

### PickupStatusCard
- Shows transporter status (ready for pickup, scheduled, completed)
- Displays transporter contact information
- Provides tracking functionality if available

### NotificationPanel
- Displays customer notifications
- Shows notification types with appropriate styling
- Includes date and time information

## PWA & Offline Capabilities

The implementation maintains PWA features:
- Network status detection using online/offline events
- Appropriate messaging when offline
- Loading states and skeleton UI
- Proper error handling for network failures

## Integration Points

### With Existing Systems
- Integrates with existing customer authentication via OTP
- Uses existing Supabase setup and RLS policies
- Maintains compatibility with existing ticket workflows
- Works with existing notification systems
- Compatible with existing admin interfaces

### Data Streams
- Contributes to the ticket_stream (via timeline events)
- Contributes to the actor_stream (customer interactions)
- Contributes to the event_telemetry_stream (timeline events)

## Development Considerations

### Error Handling
- Comprehensive error handling in API routes
- Client-side error feedback via toast notifications
- Proper validation with Zod schemas
- Graceful degradation when API calls fail

### Performance
- Proper indexing for efficient queries
- Optimized API responses
- Caching-friendly component design
- Efficient rendering with React hooks

### Security
- All customer data access verified through RLS
- Customer can only interact with their own data
- Proper authentication required for all endpoints
- Input validation on all API routes

## Deployment Notes

### Database Migrations
The implementation includes three new SQL migration files:
1. `300_c12_customer_command_center_base_tables.sql` - Creates new tables
2. `301_c12_customer_command_center_rls_policies.sql` - Applies RLS policies
3. `302_c12_extend_existing_tables.sql` - Extends existing tables

### Environment Requirements
- Next.js 16+ with PWA support
- Supabase with RLS enabled
- Proper environment variables for Supabase connection
- OTP authentication system (already implemented)

## Future Enhancements

### Potential Additions
- Enhanced SLA calculation algorithms
- Quotation history tracking
- Transporter live tracking integration
- Customer preference persistence improvements
- Advanced timeline filtering capabilities

## C12 Optimization Sprint

The following optimizations have been implemented to enhance the Customer Command Center:

### 1. Event Engine Optimizations
- **Composite Index**: Added `(ticket_id, created_at)` index to `ticket_events` table for faster querying
- **Pagination**: Implemented pagination for timeline events API with configurable page sizes (default 20, max 100)
- **Payload Normalization**: Standardized event payload structure using JSONB with type-specific schemas

### 2. SLA Enhancements
- **Predictive Warnings**: Implemented automatic detection when remaining SLA time is less than 2 hours
- **Risk Event Triggers**: Created automated events when SLA approaches risk threshold
- **SLA Calculation Functions**: Added database functions to calculate and monitor SLA status

### 3. Transporter Flow Improvements
- **Stall Detection**: Implemented detection for transporters with no movement > 15 minutes
- **Delay Flagging**: Automatic flagging of transporter delays with reason tracking
- **Pickup Risk Events**: Proactive alerts for potential pickup scheduling issues

### 4. Security Hardening
- **Ownership Update Triggers**: Track changes to ticket ownership, technician assignments, and transporter jobs
- **RLS Dead End Protection**: Enhanced security checks with additional verification layers
- **Access Violation Logging**: Comprehensive logging for unauthorized access attempts

### 5. PWA Enhancements
- **State Caching**: Implemented caching for last ticket state, SLA snapshots, recent events, and transporter state
- **Offline Functionality**: Enhanced offline experience with cached data access
- **Service Worker Extension**: Added customer-specific data caching in service worker

## Testing Strategy

The implementation includes comprehensive test coverage:
- Schema validation
- API route testing
- Component functionality
- Security validation
- Offline handling
- Integration with existing systems

For detailed test cases, refer to `c12_customer_command_center_test_plan.md`.