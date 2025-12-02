// parts-notification-service.ts
// Service functions for managing OneSignal notifications for parts system

import { supabase } from '@/lib/supabase/supabase';
import {
  sendNotificationToOneSignalPlayer,
  sendNotificationToList
} from '@/lib/notifications/onesignal-notification-service';
import { triggerCustomerNotification } from '../services/customerNotificationEngine';

/**
 * Send notification when a part request is approved
 */
export async function sendPartRequestApprovedNotification(
  requesterId: string,
  requestId: string,
  partName: string
): Promise<boolean> {
  try {
    // Get requester profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name, role')
      .eq('id', requesterId)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Requester player ID not found:', error);
      return false;
    }

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Part Request Approved',
      `Your request for ${partName} (ID: ${requestId.substring(0, 8)}...) has been approved`,
      `${window.location.origin}/tech/jobs`,
      {
        request_id: requestId,
        part_name: partName,
        type: 'part_request_approved',
        role: profile.role
      }
    );

    return true;
  } catch (error) {
    console.error('Error sending part request approved notification:', error);
    return false;
  }
}

/**
 * Send notification when a part request is rejected
 */
export async function sendPartRequestRejectedNotification(
  requesterId: string,
  requestId: string,
  partName: string,
  reason?: string
): Promise<boolean> {
  try {
    // Get requester profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name, role')
      .eq('id', requesterId)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Requester player ID not found:', error);
      return false;
    }

    const message = reason
      ? `Your request for ${partName} (ID: ${requestId.substring(0, 8)}...) has been rejected: ${reason}`
      : `Your request for ${partName} (ID: ${requestId.substring(0, 8)}...) has been rejected`;

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Part Request Rejected',
      message,
      `${window.location.origin}/tech/jobs`,
      {
        request_id: requestId,
        part_name: partName,
        type: 'part_request_rejected',
        role: profile.role
      }
    );

    return true;
  } catch (error) {
    console.error('Error sending part request rejected notification:', error);
    return false;
  }
}

/**
 * Send notification when a purchase order is created
 */
export async function sendPOCreatedNotification(
  poId: string,
  supplierName: string,
  requestedById: string
): Promise<boolean> {
  try {
    // Get requested_by profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name, role')
      .eq('id', requestedById)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Requester player ID not found:', error);
      return false;
    }

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Purchase Order Created',
      `PO #${poId.substring(0, 8)}... for ${supplierName} has been created`,
      `${window.location.origin}/app/parts/po`,
      {
        po_id: poId,
        supplier_name: supplierName,
        type: 'po_created',
        role: profile.role
      }
    );

    // Also notify all staff/admins about new PO
    await notifyStaffAboutNewPO(poId, supplierName);

    return true;
  } catch (error) {
    console.error('Error sending PO created notification:', error);
    return false;
  }
}

/**
 * Notify staff/admins about new purchase order
 */
export async function notifyStaffAboutNewPO(
  poId: string,
  supplierName: string
): Promise<void> {
  try {
    // Get all staff/admin user IDs and their OneSignal player IDs
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, id')
      .in('role', ['admin', 'staff'])
      .not('onesignal_player_id', 'is', null);

    if (error) {
      console.error('Error getting staff profiles:', error);
      return;
    }

    const playerIds = profiles
      .map(profile => profile.onesignal_player_id)
      .filter(Boolean) as string[];

    if (playerIds.length > 0) {
      await sendNotificationToList(
        playerIds,
        'New Purchase Order',
        `New PO #${poId.substring(0, 8)}... created for ${supplierName}`,
        `${window.location.origin}/app/parts/po`,
        {
          po_id: poId,
          supplier_name: supplierName,
          type: 'new_po',
          role: 'admin_staff'
        }
      );
    }
  } catch (error) {
    console.error('Error notifying staff about new PO:', error);
  }
}

/**
 * Send notification when a purchase order is approved
 */
export async function sendPOApprovedNotification(
  poId: string,
  supplierName: string,
  approvedById: string
): Promise<boolean> {
  try {
    // Get approved_by profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name, role')
      .eq('id', approvedById)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Approver player ID not found:', error);
      return false;
    }

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Purchase Order Approved',
      `PO #${poId.substring(0, 8)}... for ${supplierName} has been approved`,
      `${window.location.origin}/app/parts/po`,
      {
        po_id: poId,
        supplier_name: supplierName,
        type: 'po_approved',
        role: profile.role
      }
    );

    return true;
  } catch (error) {
    console.error('Error sending PO approved notification:', error);
    return false;
  }
}

/**
 * Send notification when shipment is on the way (ETA)
 */
export async function sendPOETAUpdateNotification(
  poId: string,
  supplierName: string,
  estimatedArrival?: string
): Promise<boolean> {
  try {
    // Get all technicians who have requested parts related to this PO
    // First get all related part requests - split into two queries

    // Get all part_ids from parts_arrivals for this PO
    const { data: partsArrivals, error: arrivalsError } = await supabase
      .from('parts_arrivals')
      .select('part_id')
      .eq('po_id', poId);

    if (arrivalsError) {
      console.error('Error getting parts arrivals for PO:', arrivalsError);
      return false;
    }

    const partIds = partsArrivals.map(arrival => arrival.part_id);

    if (partIds.length === 0) {
      console.log('No parts found for PO, no technicians to notify');
      return true;
    }

    // Now get all part requests for these parts
    const { data: partRequests, error: requestsError } = await supabase
      .from('part_requests')
      .select('requested_by')
      .in('part_id', partIds);

    if (requestsError) {
      console.error('Error getting part requests for PO:', requestsError);
      return false;
    }

    // Get unique requester IDs
    const requesterIds = Array.from(
      new Set(partRequests?.map(req => req.requested_by) || [])
    ).filter(id => id !== undefined) as string[];

    if (requesterIds.length === 0) {
      console.log('No technicians found to notify for PO ETA update');
      return true;
    }

    // Get their OneSignal player IDs
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('onesignal_player_id')
      .in('id', requesterIds)
      .not('onesignal_player_id', 'is', null);

    if (profilesError) {
      console.error('Error getting technician profiles:', profilesError);
      return false;
    }

    const playerIds = profiles
      .map(profile => profile.onesignal_player_id)
      .filter(Boolean) as string[];

    if (playerIds.length === 0) {
      console.log('No technicians with player IDs to notify for PO ETA update');
      return true;
    }

    const message = estimatedArrival
      ? `Parts from PO #${poId.substring(0, 8)}... for ${supplierName} are on the way! Expected arrival: ${new Date(estimatedArrival).toLocaleString()}`
      : `Parts from PO #${poId.substring(0, 8)}... for ${supplierName} are on the way!`;

    await sendNotificationToList(
      playerIds,
      'Parts on the Way',
      message,
      `${window.location.origin}/tech/parts`,
      {
        po_id: poId,
        supplier_name: supplierName,
        estimated_arrival: estimatedArrival,
        type: 'po_eta',
        role: 'technician'
      }
    );

    return true;
  } catch (error) {
    console.error('Error sending PO ETA update notification:', error);
    return false;
  }
}

/**
 * Send notification when parts have arrived
 */
export async function sendPartsArrivalNotification(
  poId: string,
  partName: string,
  quantityReceived: number,
  receivedById: string
): Promise<boolean> {
  try {
    // Get receiver profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name, role')
      .eq('id', receivedById)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Receiver player ID not found:', error);
      return false;
    }

    // Also get all technicians who requested parts from this PO
    // First get all part_ids from parts_arrivals for this PO
    const { data: partsArrivals, error: arrivalsError } = await supabase
      .from('parts_arrivals')
      .select('part_id')
      .eq('po_id', poId);

    if (arrivalsError) {
      console.error('Error getting parts arrivals for PO:', arrivalsError);
      return false;
    }

    const partIds = partsArrivals.map(arrival => arrival.part_id);

    if (partIds.length === 0) {
      console.log('No parts found for PO, no technicians to notify');
      return true;
    }

    // Now get all part requests for these parts
    const { data: partRequests, error: requestsError } = await supabase
      .from('part_requests')
      .select('requested_by')
      .in('part_id', partIds);

    if (requestsError) {
      console.error('Error getting part requests for PO:', requestsError);
      return false;
    }

    // Get unique requester IDs
    const requesterIds = Array.from(
      new Set(partRequests?.map(req => req.requested_by) || [])
    ).filter(id => id !== undefined) as string[];

    if (requesterIds.length === 0) {
      console.log('No technicians found to notify for parts arrival');
      return true;
    }

    // Get their OneSignal player IDs
    const { data: techProfiles, error: techError } = await supabase
      .from('profiles')
      .select('onesignal_player_id')
      .in('id', requesterIds)
      .not('onesignal_player_id', 'is', null);

    if (techError) {
      console.error('Error getting technician profiles:', techError);
      return false;
    }

    const techPlayerIds = techProfiles
      .map(profile => profile.onesignal_player_id)
      .filter(Boolean) as string[];

    // Send notification to all related technicians
    if (techPlayerIds.length > 0) {
      await sendNotificationToList(
        techPlayerIds,
        'Parts Received',
        `${quantityReceived} units of ${partName} from PO #${poId.substring(0, 8)}... have arrived and are ready for use`,
        `${window.location.origin}/tech/parts`,
        {
          po_id: poId,
          part_name: partName,
          quantity: quantityReceived,
          type: 'parts_arrived',
          role: 'technician'
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Error sending parts arrival notification:', error);
    return false;
  }
}

/**
 * Send notification to technicians when their requested parts are ready for pickup
 */
export async function sendPartsReadyForPickupNotification(
  requesterId: string,
  requestId: string,
  partName: string
): Promise<boolean> {
  try {
    // Get requester profile with OneSignal player ID
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, full_name, role')
      .eq('id', requesterId)
      .single();

    if (error || !profile?.onesignal_player_id) {
      console.error('Requester player ID not found:', error);
      return false;
    }

    await sendNotificationToOneSignalPlayer(
      profile.onesignal_player_id,
      'Parts Ready for Pickup',
      `Your requested ${partName} (ID: ${requestId.substring(0, 8)}...) is ready for pickup`,
      `${window.location.origin}/tech/parts`,
      {
        request_id: requestId,
        part_name: partName,
        type: 'parts_ready',
        role: profile.role
      }
    );

    return true;
  } catch (error) {
    console.error('Error sending parts ready notification:', error);
    return false;
  }
}

/**
 * Send notification when a supplier PO is sent/mailed
 */
export async function sendPOSentNotification(
  poId: string,
  supplierName: string,
  requestedById: string
): Promise<boolean> {
  try {
    // Get all staff/admin user IDs and their OneSignal player IDs
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('onesignal_player_id, id')
      .in('role', ['admin', 'staff'])
      .not('onesignal_player_id', 'is', null);

    if (error) {
      console.error('Error getting staff profiles:', error);
      return false;
    }

    const playerIds = profiles
      .map(profile => profile.onesignal_player_id)
      .filter(Boolean) as string[];

    if (playerIds.length > 0) {
      await sendNotificationToList(
        playerIds,
        'PO Sent to Supplier',
        `PO #${poId.substring(0, 8)}... has been sent to ${supplierName}`,
        `${window.location.origin}/app/parts/po`,
        {
          po_id: poId,
          supplier_name: supplierName,
          type: 'po_sent',
          role: 'admin_staff'
        }
      );
    }

    return true;
  } catch (error) {
    console.error('Error sending PO sent notification:', error);
    return false;
  }
}

/**
 * Send notification when a supplier PO status changes to in_transit
 */
export async function sendPOInTransitNotification(
  poId: string,
  supplierName: string
): Promise<boolean> {
  try {
    // Get all technicians who have requested parts related to this PO
    // First get all part_ids from parts_arrivals for this PO
    const { data: partsArrivals, error: arrivalsError } = await supabase
      .from('parts_arrivals')
      .select('part_id')
      .eq('po_id', poId);

    if (arrivalsError) {
      console.error('Error getting parts arrivals for PO:', arrivalsError);
      return false;
    }

    const partIds = partsArrivals.map(arrival => arrival.part_id);

    if (partIds.length === 0) {
      console.log('No parts found for PO, no technicians to notify');
      return true;
    }

    // Now get all part requests for these parts
    const { data: partRequests, error: requestsError } = await supabase
      .from('part_requests')
      .select('requested_by')
      .in('part_id', partIds);

    if (requestsError) {
      console.error('Error getting part requests for PO:', requestsError);
      return false;
    }

    // Get unique requester IDs
    const requesterIds = Array.from(
      new Set(partRequests?.map(req => req.requested_by) || [])
    ).filter(id => id !== undefined) as string[];

    if (requesterIds.length === 0) {
      console.log('No technicians found to notify for PO in transit');
      return true;
    }

    // Get their OneSignal player IDs
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('onesignal_player_id')
      .in('id', requesterIds)
      .not('onesignal_player_id', 'is', null);

    if (profilesError) {
      console.error('Error getting technician profiles:', profilesError);
      return false;
    }

    const playerIds = profiles
      .map(profile => profile.onesignal_player_id)
      .filter(Boolean) as string[];

    if (playerIds.length === 0) {
      console.log('No technicians with player IDs to notify for PO in transit');
      return true;
    }

    await sendNotificationToList(
      playerIds,
      'Parts in Transit',
      `Parts from PO #${poId.substring(0, 8)}... from ${supplierName} are now in transit`,
      `${window.location.origin}/tech/parts`,
      {
        po_id: poId,
        supplier_name: supplierName,
        type: 'po_in_transit',
        role: 'technician'
      }
    );

    return true;
  } catch (error) {
    console.error('Error sending PO in transit notification:', error);
    return false;
  }
}

/**
 * Send notification to customers when there is a part delay affecting their repair
 */
export async function sendPartDelayToCustomerNotification(
  ticketId: string
): Promise<boolean> {
  try {
    // Use the new customer notification engine
    const context = {
      ticketId,
      customerId: '', // Will be populated in the dispatch function
    };

    // This will trigger the part_delay notification rule
    const result = await triggerCustomerNotification('part_delay', context);
    return result;
  } catch (error) {
    console.error('Error sending part delay notification to customer:', error);
    return false;
  }
}