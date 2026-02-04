/**
 * Test script to verify email configuration
 */

import { sendOtpEmail } from './src/lib/utils/smtp-client';

async function testEmailConfig() {
  console.log('Testing email configuration...');

  // Test with a sample email and OTP
  const testEmail = 'test@example.com';
  const testOtp = '123456';
  const requestId = 'test-request-' + Date.now();

  console.log(`Attempting to send OTP (${testOtp}) to ${testEmail} with request ID: ${requestId}`);

  const result = await sendOtpEmail(testEmail, testOtp, requestId);

  if (result) {
    console.log('✅ Email service test completed successfully');
    console.log('If SMTP is not configured, you should see the OTP logged in the console above.');
    console.log('If SMTP is configured, you should receive an email (or see success message).');
  } else {
    console.log('❌ Email service test failed');
  }

  console.log('\nEnvironment variables check:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST ? 'SET' : 'NOT SET');
  console.log('SMTP_PORT:', process.env.SMTP_PORT ? process.env.SMTP_PORT : 'NOT SET');
  console.log('SMTP_USER:', process.env.SMTP_USER ? 'SET' : 'NOT SET');
  console.log('SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL ? 'SET' : 'NOT SET');
  console.log('Note: SMTP_PASSWORD is not displayed for security reasons');
}

// Run the test
testEmailConfig().catch(console.error);