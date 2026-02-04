// supabase/functions/transport-custody-event/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.22.0";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

interface CustodyEventRequest {
  transport_job_id: string;
  purpose: 'PICKUP_HANDOVER' | 'DROP_HANDOVER';
  otp: string;
  lat: number;
  lng: number;
  idempotency_key?: string;
  photos?: string[]; // Optional photo URLs
}

interface CustodyEventResponse {
  success: boolean;
  message: string;
  new_status?: string;
  custody_event_id?: string;
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
    const body: CustodyEventRequest = await req.json();

    // Validate required fields
    if (!body.transport_job_id || !body.purpose || !body.otp || body.lat === undefined || body.lng === undefined) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Missing required fields: transport_job_id, purpose, otp, lat, lng" 
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

    // Call the RPC function to verify OTP and handle custody event
    // Note: In a real implementation, OTP verification would happen separately
    // For this implementation, we'll call the RPC which handles the atomic operation
    const { data, error } = await supabase.rpc('rpc_transport_verify_handover', {
      p_transport_job_id: body.transport_job_id,
      p_purpose: body.purpose,
      p_otp_code: body.otp,
      p_lat: body.lat,
      p_lng: body.lng
    });

    if (error) {
      console.error("Error processing custody event:", error);
      return new Response(
        JSON.stringify({ success: false, message: `Error processing custody event: ${error.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Return custody event response
    const response: CustodyEventResponse = {
      success: data.success,
      message: data.message,
      new_status: data.new_status,
      custody_event_id: data.custody_event_id
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Unexpected error in transport-custody-event:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});