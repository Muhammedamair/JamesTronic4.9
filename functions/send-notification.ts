import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Web Push Implementation
// Note: We'll use a simplified version since Deno doesn't have native web-push support
// In a real implementation, you might need to use a different approach or library

// Import web push functionality (using a library that works in Deno)
import * as webPush from "https://esm.sh/web-push@3.6.6";

// Set VAPID details (these would be stored in environment variables)
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@jamestronic.com";

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

console.log("Send notification function initialized");

serve(async (req) => {
  console.log(`${req.method} ${req.url}`);

  try {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Get the JWT token from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Missing or invalid Authorization header", { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid user:", userError);
      return new Response("Unauthorized", { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return new Response("Unauthorized", { status: 401 });
    }

    // Only allow admin/staff roles to send notifications
    if (!["admin", "staff"].includes(profile.role)) {
      return new Response("Forbidden: Insufficient permissions", { status: 403 });
    }

    // Parse the request body
    const { userIds, title, body, tag, url, data } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Fetch subscription details for the specified users
    const { data: subscriptions, error: subError } = await supabase
      .from("web_push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (subError) {
      console.error("Subscription fetch error:", subError);
      return new Response("Internal server error", { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found for the specified users" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body,
      tag,
      url: url || "/tech/jobs", // Default to tech jobs page
      data: data || {},
    });

    // Track successful and failed deliveries
    const successful = [];
    const failed = [];

    // Send notifications to each subscription
    for (const subscription of subscriptions) {
      try {
        // Construct the subscription object for web-push
        const browserSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        // Send the push notification
        const pushResponse = await webPush.sendNotification(
          browserSubscription,
          payload,
          {
            vapidDetails: vapidPublicKey && vapidPrivateKey 
              ? {
                  subject: vapidSubject,
                  publicKey: vapidPublicKey,
                  privateKey: vapidPrivateKey,
                }
              : undefined,
            TTL: 24 * 60 * 60, // 24 hours in seconds
          }
        );

        successful.push(subscription.id);
        console.log(`Notification sent successfully to user ${subscription.user_id}`);
      } catch (err) {
        console.error(`Failed to send notification to ${subscription.user_id}:`, err);

        // If we get a 410 Gone error, the subscription is no longer valid
        if (err.statusCode === 410) {
          // Remove the invalid subscription
          const { error: deleteError } = await supabase
            .from("web_push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);

          if (deleteError) {
            console.error("Error deleting invalid subscription:", deleteError);
          }
          
          failed.push({ subscriptionId: subscription.id, reason: "Gone (410)" });
        } else {
          failed.push({ subscriptionId: subscription.id, reason: err.message });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful.length,
        failed: failed.length,
        details: { successful, failed }
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        } 
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});