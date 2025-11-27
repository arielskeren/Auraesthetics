/**
 * Shared utility functions for discount code operations
 * Single source of truth for boolean normalization and status checks
 */

/**
 * Normalizes PostgreSQL boolean values to determine if a code is active.
 * CRITICAL: NULL values are treated as INACTIVE (not active) for data integrity.
 * 
 * Handles:
 * - true (boolean), 't' (string), 'true' (string), 1 (number) → true
 * - false (boolean), 'f' (string), 'false' (string), 0 (number) → false
 * - null, undefined → false (INACTIVE)
 * 
 * @param isActive - The raw is_active value from database
 * @returns Normalized boolean value (true = active, false = inactive)
 */
export function normalizeIsActive(isActive: any): boolean {
  // Handle null/undefined - treat as INACTIVE (changed from active for data integrity)
  if (isActive === null || isActive === undefined) {
    return false;
  }
  
  // Handle explicit false values - check multiple representations
  // PostgreSQL can return: boolean false, string 'f', string 'false', number 0
  if (
    isActive === false || 
    isActive === 'f' || 
    isActive === 'false' ||
    isActive === 0 ||
    String(isActive).toLowerCase().trim() === 'false'
  ) {
    return false;
  }
  
  // Handle explicit true values
  if (
    isActive === true || 
    isActive === 't' || 
    isActive === 'true' ||
    isActive === 1 ||
    String(isActive).toLowerCase().trim() === 'true'
  ) {
    return true;
  }
  
  // Default to INACTIVE for any unknown value (defensive - changed from active)
  return false;
}

/**
 * Checks if a discount code is active based on its is_active field.
 * Uses normalizeIsActive for consistent boolean handling.
 * 
 * @param code - Discount code object with is_active field
 * @returns true if code is active, false if inactive
 */
export function isCodeActive(code: { is_active?: any }): boolean {
  return normalizeIsActive(code.is_active);
}

/**
 * Checks if a discount code is inactive based on its is_active field.
 * Uses normalizeIsActive for consistent boolean handling.
 * 
 * @param code - Discount code object with is_active field
 * @returns true if code is inactive, false if active
 */
export function isCodeInactive(code: { is_active?: any }): boolean {
  return !normalizeIsActive(code.is_active);
}

