// Test script for C14 SLA Engine implementation
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSLAEngine() {
  console.log('Testing C14 SLA Engine Implementation...');

  try {
    // 1. Test creating an SLA policy
    console.log('\n1. Testing SLA policy creation...');
    const { data: policy, error: policyError } = await supabase
      .from('sla_policies')
      .insert([{
        name: 'Default Television Repair SLA',
        scope: 'category',
        device_category: 'television',
        base_minutes: 1440, // 24 hours
        logic: { priority_multiplier: 1.0 }
      }])
      .select()
      .single();

    if (policyError) {
      console.error('Error creating SLA policy:', policyError);
    } else {
      console.log('✓ SLA policy created:', policy?.id);
    }

    // 2. Test inserting a ticket to trigger SLA calculation
    console.log('\n2. Testing ticket insertion to trigger SLA calculation...');
    
    // First, we need a customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert([{
        name: 'Test Customer for SLA',
        phone_e164: '+919876543210',
        area: 'Test Area'
      }])
      .select()
      .single();

    if (customerError) {
      console.error('Error creating test customer:', customerError);
    } else {
      console.log('✓ Test customer created:', customer?.id);

      // Now create a ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([{
          customer_id: customer?.id,
          device_category: 'television',
          brand: 'test_brand',
          status: 'pending',
          created_by: customer?.id
        }])
        .select()
        .single();

      if (ticketError) {
        console.error('Error creating test ticket:', ticketError);
      } else {
        console.log('✓ Test ticket created:', ticket?.id);

        // 3. Check if SLA state was created automatically
        console.log('\n3. Checking if SLA state was created automatically...');
        setTimeout(async () => {
          const { data: slaState, error: slaError } = await supabase
            .from('ticket_sla_state')
            .select('*')
            .eq('ticket_id', ticket?.id)
            .single();

          if (slaError) {
            console.error('Error fetching SLA state:', slaError);
          } else {
            console.log('✓ SLA state created:', slaState);
          }

          // 4. Check if ledger entry was created
          console.log('\n4. Checking if SLA ledger entry was created...');
          const { data: ledgerEntry, error: ledgerError } = await supabase
            .from('ticket_sla_ledger')
            .select('*')
            .eq('ticket_id', ticket?.id)
            .single();

          if (ledgerError) {
            console.error('Error fetching SLA ledger:', ledgerError);
          } else {
            console.log('✓ SLA ledger entry created:', ledgerEntry);
          }

          console.log('\n✓ C14 SLA Engine implementation test completed');
        }, 2000); // Wait 2 seconds for trigger to execute
      }
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testSLAEngine();