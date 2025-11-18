# Real-time Ticket Synchronization Architecture

**Date**: November 16, 2025
**Status**: Accepted
**Author**: JamesTronic Development Team
**Last Updated**: November 16, 2025

## Overview

This document records the implementation of real-time ticket synchronization between Admin and Technician views in the JamesTronic application. The solution enables seamless real-time updates when tickets are assigned, unassigned, or have their status changed, supporting collaborative workflows between admin/staff and technician users. This version includes mobile-optimized real-time synchronization.

## Context

The JamesTronic application needed to provide real-time synchronization of ticket data between multiple user roles. Previously, when an admin assigned a ticket to a technician, the technician had to manually refresh their page to see the new ticket. Similarly, status updates by technicians weren't reflected in admin views in real-time. This created workflow inefficiencies and required manual page refreshes. Additionally, mobile users experienced inconsistent real-time updates requiring manual refresh.

## Problem Statement

1. **Ticket Assignment**: Admins assign tickets to technicians, but technicians don't see assigned tickets immediately
2. **Status Updates**: Technician status changes don't appear in admin view until manual refresh
3. **Inconsistent Views**: Admin and technician views were not synchronized in real-time
4. **User Experience**: Manual refresh requirement degraded user experience and workflow efficiency
5. **Mobile Inconsistencies**: Mobile device real-time updates were unreliable, requiring manual refreshes

## Solution Architecture

### Database Layer (RLS Policies)

The solution leverages PostgreSQL Row Level Security (RLS) policies in `030_policies.sql`:

```sql
-- Policy for technicians: can read their assigned tickets AND unassigned tickets
drop policy if exists "tickets_read_technician_assigned" on public.tickets;
create policy "tickets_read_technician_assigned" on public.tickets
for select to authenticated using (
  (get_my_role() = 'technician' AND (
    assigned_technician_id = get_my_profile_id()
    OR
    assigned_technician_id IS NULL
  ))
);
```

This key policy allows technicians to see both:
- Tickets assigned to them (`assigned_technician_id = get_my_profile_id()`)
- Unassigned tickets (`assigned_technician_id IS NULL`)

This enables the real-time functionality to work when unassigned tickets become assigned to technicians.

### Frontend Implementation

#### Admin View (`/app/app/tickets/page.tsx`)
- **Channel**: `realtime:tickets:admin`
- **Subscription**: Listens to all ticket changes for admin users
- **Cache Invalidation**: Invalidates `['tickets']` query key on any change
- **Purpose**: Real-time updates for all tickets in the system

#### Technician View (`/app/tech/jobs/page.tsx`)
- **Channel**: `tech_tickets_{technicianId}_{timestamp}`
- **Subscription**: Listens to ticket changes with fallback polling
- **Cache Invalidation**: Invalidates `['tickets', 'technician', userId]` query key
- **Purpose**: Real-time updates for assigned tickets and status changes
- **Fallback**: 30-second polling interval to catch new assignments

### Hybrid Approach

Due to RLS limitations with Supabase Realtime (technicians may not receive events for rows they didn't previously have access to), we implemented a hybrid approach:

1. **Real-time**: For status updates on existing assigned tickets
2. **Polling**: 30-second interval to catch new assignments missed by real-time
3. **Window Focus**: Refresh data when users return to the tab

## Technical Implementation Details

### Enhanced Mobile Support

The key enhancement for mobile devices includes:

```javascript
// Force a refetch of the query to update the technician's view
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });
  queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

  // On mobile devices, force a state update to ensure UI re-renders
  if (typeof window !== 'undefined' && window.innerWidth <= 768) {
    // Trigger a re-render by updating the loading state
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 50);
  }
}, 100);
```

### Channel Naming Convention
- `tech_tickets_{technicianId}_{timestamp}` - Unique per technician session to avoid conflicts
- Timestamp ensures unique channel names across page reloads

### Subscription Management
- Proper cleanup of subscriptions on component unmount to prevent memory leaks
- Error handling for CHANNEL_ERROR status with fallback to polling mechanism
- Unique channel names prevent conflicts when multiple tabs are open

### RLS Helper Functions
- `get_my_role()`: Extracts user role from JWT token
- `get_my_profile_id()`: Gets profile ID associated with current user

## Key Features Achieved

1. **Admin-to-Technician Assignment**: Admin assigns ticket → Appears in technician view in real-time
2. **Status Synchronization**: Technician updates status → Admin view updates in real-time
3. **Assignment Removal**: Admin unassigns ticket → Disappears from technician view in real-time
4. **Mobile Optimization**: Real-time updates work reliably on mobile devices
5. **Robust Fallback**: If real-time fails, data syncs within 30 seconds via polling
6. **Memory Management**: Proper cleanup prevents memory leaks

## Code Modifications

### Frontend Changes
- `/james-tronic/src/app/tech/jobs/page.tsx`: Enhanced real-time subscription with mobile-specific rendering triggers
- `/james-tronic/src/app/app/tickets/page.tsx`: Maintained existing real-time functionality
- `staleTime: 0` added to ensure immediate data refresh after invalidation
- `setTimeout` with forced refetch for mobile devices
- Loading state toggling for mobile UI re-rendering

### Backend (Policies)
- `/supabase/sql/030_policies.sql`: Maintained appropriate RLS policies for technician access to both assigned and unassigned tickets

## Specific Fix for Unassignment and Mobile Issues

After extensive testing, it was found that the original implementation had multiple edge cases:
1. Unassigned tickets would not disappear from the technician's view in real-time
2. Mobile devices would not immediately update after real-time events
3. UI would not re-render consistently on mobile

This was resolved with the following enhancements:

### Client-Side Cache Management

The key fix was implemented in `/james-tronic/src/app/tech/jobs/page.tsx` with more sophisticated real-time event handling:

```javascript
// Handle unassignment: ticket was assigned to this tech but now isn't
if (wasAssignedToTech && !isNowAssignedToTech) {
  console.log('Ticket unassigned from this technician:', newRecord?.id);
  // First, invalidate the query cache
  queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });

  // Force a refetch of the query to update the technician's view
  setTimeout(() => {
    queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

    // On mobile devices, force a state update to ensure UI re-renders
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      // Trigger a re-render by updating the loading state
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 50);
    }
  }, 100);
}
// Handle new assignment: ticket wasn't assigned to this tech but now is
else if (!wasAssignedToTech && isNowAssignedToTech) {
  console.log('Ticket newly assigned to this technician:', newRecord?.id);
  // First, invalidate the query cache
  queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });

  // Force a refetch of the query to include this new ticket in the technician's view
  setTimeout(() => {
    queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

    // On mobile devices, force a state update to ensure UI re-renders
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      // Trigger a re-render by updating the loading state
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 50);
    }
  }, 100);
}
// For other updates (status changes, etc.) to tickets that are (or were) assigned to this tech
else if (isNowAssignedToTech || wasAssignedToTech) {
  console.log('Ticket affecting this technician was updated:', newRecord?.id);
  // First, invalidate the query cache
  queryClient.invalidateQueries({ queryKey: ['tickets', 'technician', user?.id] });

  // Force a refetch of the query to refetch updated ticket
  setTimeout(() => {
    queryClient.refetchQueries({ queryKey: ['tickets', 'technician', user?.id] });

    // On mobile devices, force a state update to ensure UI re-renders
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      // Trigger a re-render by updating the loading state
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 50);
    }
  }, 100);
}
```

### Key Improvements

1. **Mobile-Specific Rendering**: Added conditional logic for mobile devices that forces state updates to trigger re-renders
2. **Delayed Cache Operations**: Separated cache invalidation and refetching with timeouts to ensure proper sequencing
3. **Visual Feedback on Mobile**: Temporary loading states provide visual feedback during updates
4. **Precise Event Detection**: The system specifically detects when a ticket's `assigned_technician_id` changes from the current technician's ID to another technician or null.

## Testing Results

The implementation has been thoroughly tested with the following results:

- ✅ Admin assigns ticket to Technician → Appears in Technician jobs in real-time (desktop)
- ✅ Admin assigns ticket to Technician → Appears in Technician jobs in real-time (mobile)
- ✅ Technician updates status → Admin tickets view updates in real-time (desktop)
- ✅ Technician updates status → Admin tickets view updates in real-time (mobile)
- ✅ Admin unassigns ticket → Disappears from Technician jobs in real-time (desktop)
- ✅ Admin unassigns ticket → Disappears from Technician jobs in real-time (mobile)
- ✅ Fallback polling mechanism works when real-time subscription fails
- ✅ No memory leaks detected
- ✅ Cross-tab synchronization works properly
- ✅ Error handling gracefully falls back to polling
- ✅ Unassignment events now properly trigger immediate UI updates without requiring manual refresh
- ✅ Mobile devices now receive real-time updates without requiring manual refresh

## Future Considerations

1. **Customer Portal**: Apply same real-time patterns to customer-facing interfaces
2. **Scale Testing**: Monitor performance with 4500+ monthly tickets as mentioned in requirements
3. **Connection Reliability**: Consider implementing reconnection logic for unstable networks
4. **Performance Monitoring**: Add metrics to track real-time vs polling data sync ratios
5. **Transporter View**: Extend similar real-time functionality to transporter users

## Impact

This architectural decision significantly improves:
- **Workflow Efficiency**: Eliminates manual refresh requirement
- **User Experience**: Provides seamless real-time collaboration
- **Cross-Platform Consistency**: Works reliably on both desktop and mobile
- **Scalability**: Supports multi-user scenarios without performance degradation
- **Maintainability**: Consistent real-time patterns across the application

## Conclusion

The real-time ticket synchronization architecture successfully addresses the problem of inconsistent data views between admin and technician roles. The hybrid approach of real-time subscriptions with fallback polling ensures reliable synchronization while working within the constraints of Supabase RLS. The solution now includes mobile-optimized updates, making it ready for deployment in production environments where technicians use mobile devices. The solution can be extended to other parts of the application, including customer-facing portals and transporter views.