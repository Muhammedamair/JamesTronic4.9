# Test Plan for Email OTP Implementation

## Objective
Verify that the email OTP login functionality works correctly and all requirements have been met.

## Prerequisites
- Database migration has been applied to Supabase
- Environment variables are properly configured
- Application is running

## Test Cases

### 1. Email OTP Request Flow
**Objective**: Verify that users can request an OTP via email

**Steps**:
1. Navigate to the login page
2. Switch to email authentication mode
3. Enter a valid email address
4. Click "Send OTP"
5. Check that OTP is generated and stored in the database
6. Verify that rate limiting works (max 5 requests per 15 minutes)

**Expected Result**: 
- OTP is sent to the email address (or logged in console)
- Entry is created in login_otp_requests table with email, channel='email', and proper expiration
- Rate limiting prevents excessive requests

### 2. Email OTP Verification Flow
**Objective**: Verify that users can verify the email OTP and get authenticated

**Steps**:
1. Request an OTP via email (as above)
2. Enter the received OTP in the verification field
3. Submit the form
4. Check that the OTP is marked as consumed in the database
5. Verify that the user session is created properly
6. Confirm that role-based routing works correctly

**Expected Result**:
- OTP is validated against the stored hash
- OTP record is marked as consumed (consumed_at is set)
- User is properly authenticated with correct role
- User is redirected to appropriate dashboard based on role

### 3. Phone OTP Regression Test
**Objective**: Verify that existing phone OTP functionality still works

**Steps**:
1. Navigate to the login page
2. Use phone number authentication (default)
3. Request OTP via WhatsApp/SMS
4. Verify the OTP
5. Check that all functionality works as before

**Expected Result**:
- Phone OTP flow works exactly as before
- No regression in existing functionality
- All security measures (device lock, etc.) still enforced

### 4. Security Verification
**Objective**: Ensure all security measures are maintained

**Steps**:
1. Verify OTP verification is still required for both email and phone
2. Test device lock enforcement for technician/transporter roles
3. Confirm RLS policies are unchanged
4. Verify no secrets are exposed in frontend code
5. Confirm PWA functionality is preserved

**Expected Result**:
- All security measures remain intact
- Device lock still enforced for technicians/transporters
- RLS policies unchanged
- No secrets exposed in frontend
- PWA functionality preserved

### 5. Error Handling
**Objective**: Verify proper error handling for edge cases

**Steps**:
1. Test with invalid email format
2. Test rate limiting (request >5 OTPs in 15 mins)
3. Test with expired OTP
4. Test with incorrect OTP
5. Test with already consumed OTP

**Expected Result**:
- Proper error messages for all invalid inputs
- Rate limiting prevents abuse
- Expired/consumed OTPs are rejected
- Invalid OTPs are rejected with proper feedback

### 6. Schema Compatibility
**Objective**: Ensure the code handles both old and new schema gracefully

**Steps**:
1. If possible, temporarily revert the email column in a test environment
2. Test that fallback mechanisms work
3. Re-apply the schema and verify functionality

**Expected Result**:
- Code gracefully handles missing email column
- Fallback mechanisms work properly
- Once schema is applied, full functionality is available

## Success Criteria
- [ ] Email OTP request and verification work correctly
- [ ] Phone OTP functionality remains unchanged
- [ ] All security measures are preserved
- [ ] Rate limiting functions for both channels
- [ ] Error handling is comprehensive
- [ ] No regressions in existing functionality
- [ ] PWA and offline functionality preserved
- [ ] Device lock enforcement still works for technician/transporter roles
- [ ] Role-based routing works correctly after authentication

## Rollback Plan
If any issues are discovered:
1. Revert the API route changes
2. Remove the new login UI elements
3. Revert database changes using: 
   ```sql
   ALTER TABLE public.login_otp_requests DROP COLUMN IF EXISTS email;
   ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
   ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms'));
   DROP INDEX IF EXISTS idx_login_otp_requests_email_created_at;
   DROP INDEX IF EXISTS idx_login_otp_requests_email_unconsumed;
   ```