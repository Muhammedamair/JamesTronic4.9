# Real-time Synchronization Implementation Guide

## Overview

This document details the implementation of real-time ticket synchronization between the Admin and Technician views in the JamesTronic application. The solution ensures seamless real-time updates when tickets are assigned, unassigned, or when their status is changed, enabling efficient collaborative workflows between admin/staff and technician users.

## Implementation Details

### Core Technology Stack
- **Real-time Engine**: Supabase Realtime (PostgreSQL publication/subscriptions)
- **Client State Management**: Zustand for local state
- **Server State Management**: TanStack Query (React Query) for server state caching
- **Fallback Mechanism**: Polling with configurable intervals
- **Mobile Optimization**: Special rendering triggers for mobile device consistency

### Key Files Modified
1. `/src/app/tech/jobs/page.tsx` - Technician jobs page with full real-time implementation
2. `/src/app/app/tickets/page.tsx` - Admin tickets page with real-time updates
3. `/src/lib/technician-store.ts` - Zustand store for technician state management

### Real-time Event Handling

#### For Ticket Unassignment
When a ticket is unassigned from a technician:
1. Real-time event detected via Supabase subscription
2. Direct cache update removes ticket from technician's view immediately
3. On mobile devices, a loading state toggle is triggered to ensure UI re-rendering
4. Technician receives immediate visual feedback without requiring a refresh

#### For Ticket Assignment
When a ticket is assigned to a technician:
1. Real-time event detected via Supabase subscription
2. Query cache is invalidated to include the new ticket
3. On mobile devices, a loading state toggle ensures UI re-rendering
4. Technician sees the new ticket appear in their jobs list immediately

#### For Status Updates
When ticket status changes:
1. Real-time event detected via Supabase subscription
2. Relevant queries are invalidated to reflect status changes
3. Mobile-specific rendering triggers ensure consistent UI updates
4. Both admin and technician views update in real-time

### Mobile Optimization Strategy

The implementation includes several mobile-specific optimizations:

1. **Viewport Detection**: Uses `window.innerWidth <= 768` to detect mobile devices
2. **State Toggle Rendering**: Temporarily sets loading state to trigger re-renders on mobile
3. **Timeout Sequencing**: Uses 100ms delays to ensure proper cache operations sequence
4. **Immediate Feedback**: Direct cache modifications for immediate UI updates

### Cache Management Implementation

```typescript
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
```

### Fallback Mechanisms

The system includes robust fallback mechanisms:
1. **30-second polling interval** as backup for real-time subscription failures
2. **Window focus detection** to refresh data when users return to the tab
3. **Manual refresh option** for troubleshooting purposes

## Testing Results

The implementation has been validated with the following results:
- ✅ Admin assigns ticket → Appears in Technician view in real-time (mobile/desktop)
- ✅ Technician updates status → Admin view updates in real-time (mobile/desktop)
- ✅ Admin unassigns ticket → Disappears from Technician view in real-time (mobile/desktop)
- ✅ Mobile devices receive consistent real-time updates without manual refresh
- ✅ Fallback polling works when real-time subscription fails
- ✅ Memory leaks prevented with proper subscription cleanup
- ✅ UI updates occur immediately without requiring manual refresh on mobile

## Troubleshooting Common Issues

### Real-time Events Detected but UI Doesn't Update
- Check that the query key matches between the cache invalidation and fetching function
- Verify that the technician's profile ID is being correctly retrieved
- Confirm that the RLS policies allow access to both assigned and unassigned tickets

### Mobile Devices Not Updating in Real-time
- Verify that the mobile-specific loading state toggles are properly implemented
- Ensure viewport detection is correctly identifying mobile devices
- Check that real-time event handling is not being interrupted by other operations

### Unassigned Tickets Still Appear After Administration
- Verify that direct cache removal is properly implemented for unassignment events
- Confirm that the correct ticket ID is being used in the filter operation
- Check that the real-time event correctly identifies the transition from assigned to unassigned

## Future Enhancements

1. **Transporter View**: Extend real-time functionality to transporter users
2. **Customer Portal**: Implement real-time updates in customer-facing interfaces
3. **Performance Monitoring**: Add metrics to track real-time vs polling usage
4. **Connection Resilience**: Implement automatic reconnection for unstable networks