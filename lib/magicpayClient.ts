/**
 * MagicPay Payment Gateway Client
 * 
 * This module provides a clean interface for interacting with MagicPay's
 * Payment API (transact.php) and Customer Vault functionality.
 * 
 * PCI Compliance Note:
 * - Card data is tokenized client-side using Collect.js
 * - Only payment_token reaches our servers
 * - Card numbers, CVV, and expiry are never handled server-side
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAGICPAY_API_URL = 'https://secure.magicpaygateway.com/api/transact.php';

function getSecurityKey(): string {
  const key = process.env.MAGICPAY_API_SECURITY_KEY;
  if (!key) {
    throw new Error('Missing MAGICPAY_API_SECURITY_KEY environment variable');
  }
  return key;
}

function getMode(): 'test' | 'live' {
  const mode = process.env.MAGICPAY_MODE;
  if (mode === 'live') return 'live';
  return 'test';
}

// =============================================================================
// TYPES
// =============================================================================

export interface MagicPayChargeInput {
  /** Payment token from Collect.js tokenization */
  paymentToken: string;
  /** Amount in dollars (e.g., 150.00) */
  amount: number;
  /** Currency code (default: USD) */
  currency?: string;
  /** Order/booking ID for reference */
  orderId: string;
  /** Order description */
  orderDescription?: string;
  /** Customer details */
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
  };
  /** Client IP address for fraud prevention */
  ipAddress?: string;
  /** Whether to save card to Customer Vault (default: true) */
  saveToVault?: boolean;
  /** Existing Customer Vault ID (for returning customers) */
  customerVaultId?: string;
}

export interface MagicPayChargeResult {
  success: boolean;
  /** Response code: 1=Approved, 2=Declined, 3=Error */
  responseCode: number;
  /** Human-readable response text */
  responseText: string;
  /** Transaction ID (for refunds, voids, etc.) */
  transactionId: string | null;
  /** Authorization code */
  authCode: string | null;
  /** Customer Vault ID (if card was saved) */
  customerVaultId: string | null;
  /** AVS response code */
  avsResponse?: string;
  /** CVV response code */
  cvvResponse?: string;
  /** Full raw response for debugging */
  rawResponse: Record<string, string>;
}

export interface MagicPayRefundInput {
  /** Original transaction ID to refund */
  transactionId: string;
  /** Amount to refund (optional - full refund if not specified) */
  amount?: number;
  /** Order ID for reference */
  orderId?: string;
}

export interface MagicPayRefundResult {
  success: boolean;
  responseCode: number;
  responseText: string;
  transactionId: string | null;
  rawResponse: Record<string, string>;
}

export interface MagicPayVoidInput {
  /** Transaction ID to void */
  transactionId: string;
}

export interface MagicPayVoidResult {
  success: boolean;
  responseCode: number;
  responseText: string;
  transactionId: string | null;
  rawResponse: Record<string, string>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse URL-encoded response from MagicPay API
 */
function parseResponse(responseText: string): Record<string, string> {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(responseText);
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Build form-encoded body for MagicPay API
 */
function buildFormBody(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return entries.join('&');
}

/**
 * Log safely (hide sensitive data in production)
 */
function safeLog(message: string, data?: Record<string, any>): void {
  const mode = getMode();
  if (mode === 'test') {
    console.log(`[MagicPay] ${message}`, data || '');
  } else {
    // In production, log minimal info
    console.log(`[MagicPay] ${message}`);
  }
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Process a payment using MagicPay
 * 
 * This function calls MagicPay's transact.php endpoint with type=sale
 * and optionally saves the card to Customer Vault.
 * 
 * @param input - Charge parameters including payment token from Collect.js
 * @returns Charge result with transaction details
 */
export async function charge(input: MagicPayChargeInput): Promise<MagicPayChargeResult> {
  const securityKey = getSecurityKey();
  
  // Build request parameters
  const params: Record<string, string | number | undefined> = {
    security_key: securityKey,
    type: 'sale',
    payment_token: input.paymentToken,
    amount: input.amount.toFixed(2),
    currency: input.currency || 'USD',
    orderid: input.orderId,
    order_description: input.orderDescription,
    
    // Customer details
    first_name: input.customer?.firstName,
    last_name: input.customer?.lastName,
    email: input.customer?.email,
    phone: input.customer?.phone,
    
    // Billing address
    address1: input.customer?.address?.street,
    city: input.customer?.address?.city,
    state: input.customer?.address?.state,
    zip: input.customer?.address?.zip,
    country: input.customer?.address?.country || 'US',
    
    // Fraud prevention
    ipaddress: input.ipAddress,
  };
  
  // Customer Vault options
  if (input.saveToVault !== false) {
    if (input.customerVaultId) {
      // Update existing vault entry
      params.customer_vault = 'update_customer';
      params.customer_vault_id = input.customerVaultId;
    } else {
      // Create new vault entry
      params.customer_vault = 'add_customer';
    }
  }
  
  safeLog('Processing charge', {
    orderId: input.orderId,
    amount: input.amount,
    hasVaultId: !!input.customerVaultId,
    saveToVault: input.saveToVault !== false,
  });
  
  try {
    const response = await fetch(MAGICPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody(params),
    });
    
    if (!response.ok) {
      throw new Error(`MagicPay API returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    const parsed = parseResponse(responseText);
    
    // Response code: 1=Approved, 2=Declined, 3=Error
    const responseCode = parseInt(parsed.response || parsed.response_code || '3', 10);
    const success = responseCode === 1;
    
    const result: MagicPayChargeResult = {
      success,
      responseCode,
      responseText: parsed.responsetext || parsed.response_text || 'Unknown response',
      transactionId: parsed.transactionid || null,
      authCode: parsed.authcode || null,
      customerVaultId: parsed.customer_vault_id || null,
      avsResponse: parsed.avsresponse,
      cvvResponse: parsed.cvvresponse,
      rawResponse: parsed,
    };
    
    safeLog(success ? 'Charge successful' : 'Charge failed', {
      responseCode,
      responseText: result.responseText,
      transactionId: result.transactionId,
      hasVaultId: !!result.customerVaultId,
    });
    
    return result;
  } catch (error: any) {
    console.error('[MagicPay] Charge error:', error?.message || error);
    return {
      success: false,
      responseCode: 3,
      responseText: error?.message || 'Failed to process payment',
      transactionId: null,
      authCode: null,
      customerVaultId: null,
      rawResponse: {},
    };
  }
}

/**
 * Process a refund for a previous transaction
 * 
 * @param input - Refund parameters including original transaction ID
 * @returns Refund result
 */
export async function refund(input: MagicPayRefundInput): Promise<MagicPayRefundResult> {
  const securityKey = getSecurityKey();
  
  const params: Record<string, string | number | undefined> = {
    security_key: securityKey,
    type: 'refund',
    transactionid: input.transactionId,
    amount: input.amount?.toFixed(2),
    orderid: input.orderId,
  };
  
  safeLog('Processing refund', {
    transactionId: input.transactionId,
    amount: input.amount,
  });
  
  try {
    const response = await fetch(MAGICPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody(params),
    });
    
    if (!response.ok) {
      throw new Error(`MagicPay API returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    const parsed = parseResponse(responseText);
    
    const responseCode = parseInt(parsed.response || parsed.response_code || '3', 10);
    const success = responseCode === 1;
    
    const result: MagicPayRefundResult = {
      success,
      responseCode,
      responseText: parsed.responsetext || parsed.response_text || 'Unknown response',
      transactionId: parsed.transactionid || null,
      rawResponse: parsed,
    };
    
    safeLog(success ? 'Refund successful' : 'Refund failed', {
      responseCode,
      responseText: result.responseText,
      transactionId: result.transactionId,
    });
    
    return result;
  } catch (error: any) {
    console.error('[MagicPay] Refund error:', error?.message || error);
    return {
      success: false,
      responseCode: 3,
      responseText: error?.message || 'Failed to process refund',
      transactionId: null,
      rawResponse: {},
    };
  }
}

/**
 * Void a transaction (before it settles)
 * 
 * @param input - Void parameters including transaction ID
 * @returns Void result
 */
export async function voidTransaction(input: MagicPayVoidInput): Promise<MagicPayVoidResult> {
  const securityKey = getSecurityKey();
  
  const params: Record<string, string | number | undefined> = {
    security_key: securityKey,
    type: 'void',
    transactionid: input.transactionId,
  };
  
  safeLog('Processing void', {
    transactionId: input.transactionId,
  });
  
  try {
    const response = await fetch(MAGICPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody(params),
    });
    
    if (!response.ok) {
      throw new Error(`MagicPay API returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    const parsed = parseResponse(responseText);
    
    const responseCode = parseInt(parsed.response || parsed.response_code || '3', 10);
    const success = responseCode === 1;
    
    const result: MagicPayVoidResult = {
      success,
      responseCode,
      responseText: parsed.responsetext || parsed.response_text || 'Unknown response',
      transactionId: parsed.transactionid || null,
      rawResponse: parsed,
    };
    
    safeLog(success ? 'Void successful' : 'Void failed', {
      responseCode,
      responseText: result.responseText,
    });
    
    return result;
  } catch (error: any) {
    console.error('[MagicPay] Void error:', error?.message || error);
    return {
      success: false,
      responseCode: 3,
      responseText: error?.message || 'Failed to void transaction',
      transactionId: null,
      rawResponse: {},
    };
  }
}

/**
 * Charge a customer using their saved vault ID (without Collect.js token)
 * 
 * This can be used for recurring charges or when the customer has opted
 * to use a saved card.
 * 
 * @param input - Charge parameters with customerVaultId instead of paymentToken
 * @returns Charge result
 */
export async function chargeVault(input: Omit<MagicPayChargeInput, 'paymentToken'> & { customerVaultId: string }): Promise<MagicPayChargeResult> {
  const securityKey = getSecurityKey();
  
  const params: Record<string, string | number | undefined> = {
    security_key: securityKey,
    type: 'sale',
    customer_vault_id: input.customerVaultId,
    amount: input.amount.toFixed(2),
    currency: input.currency || 'USD',
    orderid: input.orderId,
    order_description: input.orderDescription,
    ipaddress: input.ipAddress,
  };
  
  safeLog('Processing vault charge', {
    orderId: input.orderId,
    amount: input.amount,
    vaultId: input.customerVaultId.substring(0, 8) + '...',
  });
  
  try {
    const response = await fetch(MAGICPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody(params),
    });
    
    if (!response.ok) {
      throw new Error(`MagicPay API returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    const parsed = parseResponse(responseText);
    
    const responseCode = parseInt(parsed.response || parsed.response_code || '3', 10);
    const success = responseCode === 1;
    
    const result: MagicPayChargeResult = {
      success,
      responseCode,
      responseText: parsed.responsetext || parsed.response_text || 'Unknown response',
      transactionId: parsed.transactionid || null,
      authCode: parsed.authcode || null,
      customerVaultId: input.customerVaultId,
      avsResponse: parsed.avsresponse,
      cvvResponse: parsed.cvvresponse,
      rawResponse: parsed,
    };
    
    safeLog(success ? 'Vault charge successful' : 'Vault charge failed', {
      responseCode,
      responseText: result.responseText,
      transactionId: result.transactionId,
    });
    
    return result;
  } catch (error: any) {
    console.error('[MagicPay] Vault charge error:', error?.message || error);
    return {
      success: false,
      responseCode: 3,
      responseText: error?.message || 'Failed to process payment',
      transactionId: null,
      authCode: null,
      customerVaultId: null,
      rawResponse: {},
    };
  }
}

/**
 * Delete a customer from the vault
 * 
 * @param customerVaultId - The vault ID to delete
 * @returns Success status
 */
export async function deleteVaultCustomer(customerVaultId: string): Promise<{ success: boolean; responseText: string }> {
  const securityKey = getSecurityKey();
  
  const params: Record<string, string> = {
    security_key: securityKey,
    customer_vault: 'delete_customer',
    customer_vault_id: customerVaultId,
  };
  
  safeLog('Deleting vault customer', {
    vaultId: customerVaultId.substring(0, 8) + '...',
  });
  
  try {
    const response = await fetch(MAGICPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: buildFormBody(params),
    });
    
    if (!response.ok) {
      throw new Error(`MagicPay API returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    const parsed = parseResponse(responseText);
    
    const responseCode = parseInt(parsed.response || parsed.response_code || '3', 10);
    const success = responseCode === 1;
    
    safeLog(success ? 'Vault customer deleted' : 'Failed to delete vault customer', {
      responseCode,
      responseText: parsed.responsetext,
    });
    
    return {
      success,
      responseText: parsed.responsetext || parsed.response_text || 'Unknown response',
    };
  } catch (error: any) {
    console.error('[MagicPay] Delete vault error:', error?.message || error);
    return {
      success: false,
      responseText: error?.message || 'Failed to delete customer from vault',
    };
  }
}

