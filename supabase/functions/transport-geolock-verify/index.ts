// supabase/functions/transport-geolock-verify/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface GeolockRequest {
  transport_job_id: string;
  purpose: 'PICKUP_HANDOVER' | 'DROP_HANDOVER';
  lat: number;
  lng: number;
}

interface GeolockResponse {
  within_geofence: boolean;
  distance_meters: number | null;
  radius_meters: number;
  message: string;
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

    // Check user role (must be transporter or admin/staff)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || 
        (profile.role !== 'transporter' && profile.role !== 'admin' && profile.role !== 'staff')) {
      return new Response(
        JSON.stringify({ success: false, message: "Access denied: transporter, admin, or staff role required" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse the request body
    const body: GeolockRequest = await req.json();

    // Validate required fields
    if (!body.transport_job_id || !body.purpose || body.lat === undefined || body.lng === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing required fields: transport_job_id, purpose, lat, lng" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate purpose
    if (!['PICKUP_HANDOVER', 'DROP_HANDOVER'].includes(body.purpose)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Invalid purpose: must be PICKUP_HANDOVER or DROP_HANDOVER" 
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call the RPC function to check geolock
    const { data, error } = await supabase.rpc('rpc_transport_geolock_check', {
      p_transport_job_id: body.transport_job_id,
      p_purpose: body.purpose,
      p_lat: body.lat,
      p_lng: body.lng
    });

    if (error) {
      console.error("Error checking geolock:", error);
      return new Response(
        JSON.stringify({ success: false, message: `Error checking geolock: ${error.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return geolock response
    const response: GeolockResponse = {
      within_geofence: data.within_geofence,
      distance_meters: data.distance_meters,
      radius_meters: data.radius_meters,
      message: data.message
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Unexpected error in transport-geolock-verify:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});