# Environment Variables for Interakt OTP Integration

These environment variables are required for the OTP authentication system using Interakt.

## Backend-only variables (NEVER expose to frontend):

```
# Interakt API Configuration
INTERAKT_API_BASE_URL=                     # Base URL for Interakt API (e.g., https://api.interakt.com/v4)
INTERAKT_API_KEY=                          # Secret Key from Interakt Developer Settings
INTERAKT_WHATSAPP_OTP_TEMPLATE_NAME=       # Name of the approved WhatsApp OTP template (e.g., 'jamestronic_login_otp')
INTERAKT_WHATSAPP_SENDER_PHONE=            # WhatsApp sender phone in format like '9190522222901'
INTERAKT_WEBHOOK_VERIFY_TOKEN=             # Token to verify incoming webhooks from Interakt

# Supabase Service Role Key (for backend operations only)
SUPABASE_SERVICE_ROLE_KEY=                 # Service role key with full database access for backend operations
```

## Frontend variables (can be exposed):

```
# Supabase Public Variables
NEXT_PUBLIC_SUPABASE_URL=                  # Public URL of your Supabase project
NEXT_PUBLIC_SUPABASE_ANON_KEY=             # Anonymous key for client-side operations
```

## How to obtain these values:

### Interakt API Configuration:
1. Login to your Interakt dashboard
2. Go to Settings > Developer Settings
3. Copy the "Secret Key" as your INTERAKT_API_KEY
4. Note the API base URL (usually https://api.interakt.com/v4)
5. Create a WhatsApp template for OTP with name like 'jamestronic_login_otp' 
6. Get your WhatsApp sender phone number from your Interakt account

### Supabase Configuration:
1. Go to your Supabase project dashboard
2. Get the URL and anon key from Project Settings > API
3. Get the service role key from Project Settings > API (keep this secure!)

## Example .env.local file:

```
# Interakt API Configuration
INTERAKT_API_BASE_URL=https://api.interakt.com/v4
INTERAKT_API_KEY=sk_...
INTERAKT_WHATSAPP_OTP_TEMPLATE_NAME=jamestronic_login_otp
INTERAKT_WHATSAPP_SENDER_PHONE=9190522222901
INTERAKT_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```