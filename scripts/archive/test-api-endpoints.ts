import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.BASE_URL || 'http://localhost:9999';

// Test colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName: string) {
  console.log(`\n${'='.repeat(60)}`);
  log(`Testing: ${testName}`, 'blue');
  console.log('='.repeat(60));
}

async function testDiscountValidation() {
  logTest('Discount Code Validation');

  // Test 1: Valid discount code (WELCOME15)
  try {
    log('\n1. Testing valid discount code (WELCOME15) with $200 amount...', 'yellow');
    const response1 = await axios.post(`${BASE_URL}/api/payments/validate-discount`, {
      code: 'WELCOME15',
      amount: 200,
    });

    if (response1.status === 200 && response1.data.valid) {
      log('✅ Valid discount code test passed!', 'green');
      console.log('   Response:', JSON.stringify(response1.data, null, 2));
      
      // Verify discount calculation (15% of $200 = $30, but capped at $30)
      const expectedDiscount = 30; // 15% of 200 = 30, which is at the cap
      const expectedFinal = 170; // 200 - 30
      
      if (response1.data.discountAmount === expectedDiscount && 
          response1.data.finalAmount === expectedFinal) {
        log('✅ Discount calculation is correct!', 'green');
      } else {
        log(`⚠️  Discount calculation mismatch. Expected discount: $${expectedDiscount}, got: $${response1.data.discountAmount}`, 'yellow');
      }
    } else {
      log('❌ Valid discount code test failed!', 'red');
      console.log('   Response:', response1.data);
    }
  } catch (error: any) {
    log('❌ Valid discount code test failed!', 'red');
    console.error('   Error:', error.response?.data || error.message);
  }

  // Test 2: Valid discount code with amount over cap (15% exceeds $30)
  try {
    log('\n2. Testing discount code with amount where 15% > $30 cap...', 'yellow');
    const response2 = await axios.post(`${BASE_URL}/api/payments/validate-discount`, {
      code: 'WELCOME15',
      amount: 500, // 15% of 500 = $75, but should cap at $30
    });

    if (response2.status === 200 && response2.data.valid) {
      log('✅ Discount cap test passed!', 'green');
      console.log('   Response:', JSON.stringify(response2.data, null, 2));
      
      // Verify discount is capped at $30
      if (response2.data.discountAmount === 30) {
        log('✅ Discount is correctly capped at $30!', 'green');
      } else {
        log(`⚠️  Discount cap not working. Expected: $30, got: $${response2.data.discountAmount}`, 'yellow');
      }
    } else {
      log('❌ Discount cap test failed!', 'red');
      console.log('   Response:', response2.data);
    }
  } catch (error: any) {
    log('❌ Discount cap test failed!', 'red');
    console.error('   Error:', error.response?.data || error.message);
  }

  // Test 3: Invalid discount code
  try {
    log('\n3. Testing invalid discount code...', 'yellow');
    const response3 = await axios.post(`${BASE_URL}/api/payments/validate-discount`, {
      code: 'INVALID_CODE',
      amount: 100,
    });

    if (response3.status === 400 && !response3.data.valid) {
      log('✅ Invalid discount code test passed!', 'green');
      console.log('   Response:', JSON.stringify(response3.data, null, 2));
    } else {
      log('❌ Invalid discount code test failed!', 'red');
      console.log('   Response:', response3.data);
    }
  } catch (error: any) {
    if (error.response?.status === 400 && !error.response?.data.valid) {
      log('✅ Invalid discount code test passed!', 'green');
      console.log('   Response:', error.response.data);
    } else {
      log('❌ Invalid discount code test failed!', 'red');
      console.error('   Error:', error.response?.data || error.message);
    }
  }

  // Test 4: Missing required fields
  try {
    log('\n4. Testing missing required fields...', 'yellow');
    const response4 = await axios.post(`${BASE_URL}/api/payments/validate-discount`, {
      code: 'WELCOME15',
      // Missing amount
    });

    log('❌ Missing fields test failed - should return 400!', 'red');
    console.log('   Response:', response4.data);
  } catch (error: any) {
    if (error.response?.status === 400) {
      log('✅ Missing fields test passed!', 'green');
      console.log('   Error response:', error.response.data);
    } else {
      log('❌ Missing fields test failed!', 'red');
      console.error('   Error:', error.response?.data || error.message);
    }
  }
}

async function testPaymentIntentCreation() {
  logTest('Payment Intent Creation');

  // Test 1: Create payment intent for full payment
  try {
    log('\n1. Testing full payment intent creation...', 'yellow');
    const response1 = await axios.post(`${BASE_URL}/api/payments/create-intent`, {
      serviceId: 'test-service',
      serviceName: 'Test Service',
      amount: 150,
      paymentType: 'full',
    });

    if (response1.status === 200 && response1.data.clientSecret) {
      log('✅ Full payment intent creation passed!', 'green');
      console.log('   Payment Intent ID:', response1.data.paymentIntentId);
      console.log('   Amount:', response1.data.amount);
      console.log('   Payment Type:', response1.data.paymentType);
    } else {
      log('❌ Full payment intent creation failed!', 'red');
      console.log('   Response:', response1.data);
    }
  } catch (error: any) {
    log('❌ Full payment intent creation failed!', 'red');
    console.error('   Error:', error.response?.data || error.message);
  }

  // Test 2: Create payment intent with discount code
  try {
    log('\n2. Testing payment intent with discount code...', 'yellow');
    const response2 = await axios.post(`${BASE_URL}/api/payments/create-intent`, {
      serviceId: 'test-service',
      serviceName: 'Test Service',
      amount: 200,
      paymentType: 'full',
      discountCode: 'WELCOME15',
    });

    if (response2.status === 200 && response2.data.clientSecret) {
      log('✅ Payment intent with discount passed!', 'green');
      console.log('   Original Amount:', response2.data.originalAmount);
      console.log('   Discount Amount:', response2.data.discountAmount);
      console.log('   Final Amount:', response2.data.finalAmount);
      
      if (response2.data.discountAmount > 0) {
        log('✅ Discount was applied correctly!', 'green');
      } else {
        log('⚠️  Discount was not applied', 'yellow');
      }
    } else {
      log('❌ Payment intent with discount failed!', 'red');
      console.log('   Response:', response2.data);
    }
  } catch (error: any) {
    log('❌ Payment intent with discount failed!', 'red');
    console.error('   Error:', error.response?.data || error.message);
  }

  // Test 3: Create deposit payment intent
  try {
    log('\n3. Testing deposit payment intent (50%)...', 'yellow');
    const response3 = await axios.post(`${BASE_URL}/api/payments/create-intent`, {
      serviceId: 'test-service',
      serviceName: 'Test Service',
      amount: 200,
      paymentType: 'deposit',
      depositPercent: 50,
    });

    if (response3.status === 200 && response3.data.clientSecret) {
      log('✅ Deposit payment intent creation passed!', 'green');
      console.log('   Original Amount:', response3.data.originalAmount);
      console.log('   Deposit Amount:', response3.data.depositAmount);
      console.log('   Balance Due:', response3.data.balanceDue);
      
      if (response3.data.depositAmount === 100 && response3.data.balanceDue === 100) {
        log('✅ Deposit and balance amounts are correct (50% of $200 = $100)!', 'green');
      } else {
        log(
          `⚠️  Deposit/balance mismatch. Expected deposit: $100 & balance: $100, got deposit: $${response3.data.depositAmount}, balance: $${response3.data.balanceDue}`,
          'yellow'
        );
      }
    } else {
      log('❌ Deposit payment intent creation failed!', 'red');
      console.log('   Response:', response3.data);
    }
  } catch (error: any) {
    log('❌ Deposit payment intent creation failed!', 'red');
    console.error('   Error:', error.response?.data || error.message);
  }
}

async function testBookingCreation() {
  logTest('Booking Creation');

  try {
    log('\n1. Testing booking record creation...', 'yellow');
    const response = await axios.post(`${BASE_URL}/api/bookings/create`, {
      serviceId: 'test-service-id',
      serviceName: 'Test Service',
      clientEmail: 'test@example.com',
      clientName: 'Test User',
      amount: 150,
      finalAmount: 150,
      paymentStatus: 'pending',
      paymentIntentId: 'pi_test_123',
    });

    if (response.status === 200 && response.data.booking) {
      log('✅ Booking creation passed!', 'green');
      console.log('   Booking ID:', response.data.booking.id);
      console.log('   Service:', response.data.booking.serviceName);
      console.log('   Status:', response.data.booking.paymentStatus);
      
      // Store booking ID for update test
      return response.data.booking.id;
    } else {
      log('❌ Booking creation failed!', 'red');
      console.log('   Response:', response.data);
      return null;
    }
  } catch (error: any) {
    log('❌ Booking creation failed!', 'red');
    console.error('   Error:', error.response?.data || error.message);
    return null;
  }
}

async function runAllTests() {
  console.log('\n');
  log('🚀 Starting API Endpoint Tests', 'blue');
  log(`📍 Base URL: ${BASE_URL}`, 'blue');
  log('⚠️  Make sure your dev server is running on port 9999!', 'yellow');
  console.log('\n');

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/api/subscribe`, { timeout: 2000 });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      log('❌ Cannot connect to server! Make sure dev server is running:', 'red');
      log('   Run: npm run dev', 'yellow');
      process.exit(1);
    }
  }

  // Run tests
  await testDiscountValidation();
  await testPaymentIntentCreation();
  const bookingId = await testBookingCreation();

  // Summary
  console.log('\n');
  log('='.repeat(60), 'blue');
  log('✅ Tests completed!', 'green');
  log('='.repeat(60), 'blue');
  console.log('\n');
}

// Run tests
runAllTests().catch((error) => {
  console.error('Test runner error:', error);
  process.exit(1);
});


