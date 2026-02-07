// PWA Cache Service for Customer Data
// This service provides caching functionality for customer-specific data in PWA

// Define cache names for different types of data
const CUSTOMER_TICKET_STATE_CACHE = 'customer-ticket-state-v1';
const CUSTOMER_SLA_CACHE = 'customer-sla-v1';
const CUSTOMER_EVENTS_CACHE = 'customer-events-v1';
const CUSTOMER_TRANSPORTER_CACHE = 'customer-transporter-v1';

// Function to cache last ticket state
export async function cacheLastTicketState(ticketId: string, ticketData: any) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_TICKET_STATE_CACHE);
      await cache.put(`/api/customer/tickets/${ticketId}`, new Response(
        JSON.stringify(ticketData),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }
  } catch (error) {
    console.error('Error caching ticket state:', error);
  }
}

// Function to cache SLA snapshot
export async function cacheSLASnapshot(ticketId: string, slaData: any) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_SLA_CACHE);
      await cache.put(`/api/customer/sla/${ticketId}`, new Response(
        JSON.stringify(slaData),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }
  } catch (error) {
    console.error('Error caching SLA data:', error);
  }
}

// Function to cache recent events
export async function cacheRecentEvents(ticketId: string, eventsData: any) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_EVENTS_CACHE);
      await cache.put(`/api/customer/timeline/${ticketId}`, new Response(
        JSON.stringify(eventsData),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }
  } catch (error) {
    console.error('Error caching events:', error);
  }
}

// Function to cache transporter state
export async function cacheTransporterState(ticketId: string, transporterData: any) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_TRANSPORTER_CACHE);
      await cache.put(`/api/customer/transporter/${ticketId}`, new Response(
        JSON.stringify(transporterData),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    }
  } catch (error) {
    console.error('Error caching transporter data:', error);
  }
}

// Function to get cached ticket state
export async function getCachedTicketState(ticketId: string) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_TICKET_STATE_CACHE);
      const response = await cache.match(`/api/customer/tickets/${ticketId}`);
      return response ? await response.json() : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting cached ticket state:', error);
    return null;
  }
}

// Function to get cached SLA data
export async function getCachedSLA(ticketId: string) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_SLA_CACHE);
      const response = await cache.match(`/api/customer/sla/${ticketId}`);
      return response ? await response.json() : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting cached SLA:', error);
    return null;
  }
}

// Function to get cached events
export async function getCachedEvents(ticketId: string) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_EVENTS_CACHE);
      const response = await cache.match(`/api/customer/timeline/${ticketId}`);
      return response ? await response.json() : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting cached events:', error);
    return null;
  }
}

// Function to get cached transporter state
export async function getCachedTransporterState(ticketId: string) {
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(CUSTOMER_TRANSPORTER_CACHE);
      const response = await cache.match(`/api/customer/transporter/${ticketId}`);
      return response ? await response.json() : null;
    }
    return null;
  } catch (error) {
    console.error('Error getting cached transporter state:', error);
    return null;
  }
}

// Function to update all customer caches
export async function updateCustomerCaches(
  ticketId: string,
  ticketData: any,
  slaData: any,
  eventsData: any,
  transporterData: any
) {
  await cacheLastTicketState(ticketId, ticketData);
  if (slaData) await cacheSLASnapshot(ticketId, slaData);
  if (eventsData) await cacheRecentEvents(ticketId, eventsData);
  if (transporterData) await cacheTransporterState(ticketId, transporterData);
}