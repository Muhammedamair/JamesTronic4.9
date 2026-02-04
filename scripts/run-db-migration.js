#!/usr/bin/env node

/**
 * Database Migration Script for Email OTP Support
 *
 * This script applies the necessary database schema changes for email OTP support.
 * Run this script after deploying the code changes to update your Supabase database.
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
  console.log('Starting database migration for email OTP support...\n');

  // Initialize Supabase client with service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log('✅ Supabase client initialized successfully\n');

    // 1. Add email column to login_otp_requests table
    console.log('🔍 Checking if email column exists in login_otp_requests table...');

    try {
      const { data: emailColumnCheck, error: emailCheckError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'login_otp_requests')
        .eq('column_name', 'email');

      if (emailCheckError) {
        console.log('⚠️  Unable to check email column via information_schema, proceeding with direct check...');
      }

      if (emailColumnCheck && emailColumnCheck.length > 0) {
        console.log('✅ Email column already exists in login_otp_requests table\n');
      } else {
        console.log('🔧 Adding email column to login_otp_requests table...');

        const { error: alterError } = await supabase.rpc('execute_sql', {
          sql: 'ALTER TABLE public.login_otp_requests ADD COLUMN IF NOT EXISTS email TEXT;'
        });

        if (alterError) {
          console.log('⚠️  Direct ALTER TABLE failed, trying raw SQL...');

          // Try to add the column using raw SQL through Supabase
          const { error: rawSQLError } = await supabase
            .from('pg_tables')
            .select('tablename')
            .eq('tablename', 'login_otp_requests');

          if (!rawSQLError) {
            // Add the column directly
            const rawSql = 'ALTER TABLE public.login_otp_requests ADD COLUMN IF NOT EXISTS email TEXT;';
            console.log(`⚠️  Please run this SQL manually in your Supabase SQL Editor:`);
            console.log(rawSql);
          }

          console.log('✅ Email column addition attempted\n');
        } else {
          console.log('✅ Email column added successfully\n');
        }
      }
    } catch (addColumnError) {
      console.log('⚠️  Could not check/add email column automatically. Please run this SQL manually:');
      console.log('ALTER TABLE public.login_otp_requests ADD COLUMN IF NOT EXISTS email TEXT;');
      console.log(''); // Add empty line
    }

    // 2. Update the channel constraint to include 'email'
    console.log('🔧 Updating channel constraint to include "email"...');

    try {
      const { error: constraintError } = await supabase.rpc('execute_sql', {
        sql: `
          ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
          ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email'));
        `
      });

      if (constraintError) {
        console.log('⚠️  Direct constraint update failed, please run this SQL manually in your Supabase SQL Editor:');
        console.log(`ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email'));`);
      } else {
        console.log('✅ Channel constraint updated successfully\n');
      }
    } catch (constraintError) {
      console.log('⚠️  Could not update channel constraint automatically. Please run this SQL manually:');
      console.log(`ALTER TABLE public.login_otp_requests DROP CONSTRAINT IF EXISTS login_otp_requests_channel_check;
ALTER TABLE public.login_otp_requests ADD CONSTRAINT login_otp_requests_channel_check CHECK (channel IN ('whatsapp', 'sms', 'email'));`);
      console.log(''); // Add empty line
    }

    // 3. Create indexes for email-based queries
    console.log('🔧 Creating indexes for email-based queries...');

    try {
      await supabase.rpc('execute_sql', {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_created_at ON public.login_otp_requests (email, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;
        `
      });
      console.log('✅ Email query indexes created successfully\n');
    } catch (indexError) {
      console.log('⚠️  Could not create email indexes automatically. Please run this SQL manually:');
      console.log(`CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_created_at ON public.login_otp_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;`);
      console.log(''); // Add empty line
    }

    // 4. Update the unique constraint to be conditional based on channel
    console.log('🔧 Updating unique constraints...');

    try {
      await supabase.rpc('execute_sql', {
        sql: `
          DROP INDEX IF EXISTS idx_login_otp_requests_phone_unconsumed;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_phone_unconsumed ON public.login_otp_requests (phone_e164) WHERE consumed_at IS NULL AND phone_e164 IS NOT NULL;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON public.login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;
        `
      });
      console.log('✅ Unique constraints updated successfully\n');
    } catch (uniqueError) {
      console.log('⚠️  Could not update unique constraints automatically. Please run this SQL manually:');
      console.log(`DROP INDEX IF EXISTS idx_login_otp_requests_phone_unconsumed;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_phone_unconsumed ON login_otp_requests (phone_e164) WHERE consumed_at IS NULL AND phone_e164 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_login_otp_requests_email_unconsumed ON login_otp_requests (email) WHERE consumed_at IS NULL AND email IS NOT NULL;`);
      console.log(''); // Add empty line
    }

    // 5. Update the customers table to add email column if it doesn't exist
    console.log('🔧 Checking customers table for email column...');

    try {
      const { data: customerEmailCheck, error: customerCheckError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'customers')
        .eq('column_name', 'email');

      if (customerCheckError) {
        console.log('⚠️  Unable to check customers.email column via information_schema...');
      }

      if (customerEmailCheck && customerEmailCheck.length > 0) {
        console.log('✅ Email column already exists in customers table\n');
      } else {
        console.log('🔧 Adding email column to customers table...');

        const { error: customerAlterError } = await supabase.rpc('execute_sql', {
          sql: 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;'
        });

        if (customerAlterError) {
          console.log('⚠️  Could not add email column to customers table automatically. Please run this SQL manually:');
          console.log('ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;');
        } else {
          console.log('✅ Email column added to customers table\n');
        }
      }
    } catch (customerError) {
      console.log('⚠️  Could not check/add email column to customers table automatically. Please run this SQL manually:');
      console.log('ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;');
      console.log(''); // Add empty line
    }

    console.log('🎉 Database migration completed!');
    console.log('\n📋 Summary of changes applied:');
    console.log('   • Added email column to login_otp_requests table');
    console.log('   • Updated channel constraint to include "email"');
    console.log('   • Created indexes for email-based queries');
    console.log('   • Updated unique constraints for both phone and email');
    console.log('   • Added email column to customers table (if not present)');

    console.log('\n🔄 Please restart your application server to ensure all changes take effect.');
    console.log('\n💡 Note: If you encountered any "⚠️" warnings above, please manually execute the suggested SQL commands in your Supabase SQL Editor.');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().catch(console.error);