import dotenv from 'dotenv';
import { testConnection, query } from '../app/_utils/db';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testDatabase() {
  console.log('🔍 Testing database connection...\n');

  // Test 1: Basic connection
  console.log('Test 1: Testing connection...');
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Connection test failed');
    process.exit(1);
  }

  // Test 2: Query bookings table
  console.log('\nTest 2: Checking bookings table...');
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.NEON_DATABASE_URL!);
    const result = await sql`SELECT COUNT(*) as count FROM bookings`;
    console.log('✅ Bookings table exists:', result);
  } catch (error) {
    console.error('❌ Error querying bookings table:', error);
    process.exit(1);
  }

  // Test 3: Query discount_codes table
  console.log('\nTest 3: Checking discount_codes table...');
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.NEON_DATABASE_URL!);
    const result = await sql`SELECT * FROM discount_codes`;
    console.log('✅ Discount codes table exists. Current codes:');
    console.log(result);
  } catch (error) {
    console.error('❌ Error querying discount_codes table:', error);
    process.exit(1);
  }

  console.log('\n✅ All database tests passed!');
  process.exit(0);
}

testDatabase().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});

