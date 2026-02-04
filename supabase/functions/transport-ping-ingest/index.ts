// supabase/functions/transport-ping-ingest/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Rate limiting: Store last ping time per transporter
const rateLimitStore = new Map<string, number>();

interface PingRequest {
  transporter_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number;
  captured_at?: string; // ISO string
  idempotency_key?: string;
}

interface PingResponse {
  success: boolean;
  message: string;
  ping_id?: string;
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, message: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const token = authHeader.substring(7);
    
    // Verify the session and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check user role (must be transporter)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'transporter') {
      return new Response(
        JSON.stringify({ success: false, message: "Access denied: transporter role required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse the request body
    const body: PingRequest = await req.json();

    // Validate required fields
    if (!body.transporter_id || body.lat === undefined || body.lng === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing required fields: transporter_id, lat, lng" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: Check if this transporter has pinged within the last 15 seconds
    const transporterId = body.transporter_id;
    const now = Date.now();
    const lastPingTime = rateLimitStore.get(transporterId) || 0;
    
    if (now - lastPingTime < 15000) { // 15 seconds
      // Still process the request but return a success response without creating a ping
      // This prevents spam while not breaking the app
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Rate limit: ping accepted but not processed (too frequent)" 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update the rate limit store
    rateLimitStore.set(transporterId, now);

    // Call the RPC function to ingest the ping
    const { data, error } = await supabase.rpc('rpc_transport_ping_ingest', {
      p_transporter_id: transporterId,
      p_lat: body.lat,
      p_lng: body.lng,
      p_accuracy_m: body.accuracy_m || null
    });

    if (error) {
      console.error("Error ingesting ping:", error);
      return new Response(
        JSON.stringify({ success: false, message: `Error ingesting ping: ${error.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return success response
    const response: PingResponse = {
      success: true,
      message: "Ping ingested successfully",
      ping_id: data as string
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Unexpected error in transport-ping-ingest:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});