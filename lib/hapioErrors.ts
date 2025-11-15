/**
 * Hapio API Error Handling Utilities
 * Handles ValidationException (422) and ErrorException (4xx/5xx) from Hapio API
 */

export interface HapioValidationErrorField {
  field: string;
  message: string;
}

export class HapioValidationError extends Error {
  status: number;
  errors: Record<string, string[]>;
  response?: any;

  constructor(message: string, status: number, errors: Record<string, string[]>, response?: any) {
    super(message);
    this.name = 'HapioValidationError';
    this.status = status;
    this.errors = errors;
    this.response = response;
  }

  /**
   * Get field-level validation errors
   */
  getFieldErrors(): HapioValidationErrorField[] {
    const fieldErrors: HapioValidationErrorField[] = [];
    for (const [field, messages] of Object.entries(this.errors)) {
      for (const message of messages) {
        fieldErrors.push({ field, message });
      }
    }
    return fieldErrors;
  }

  /**
   * Get error message for a specific field
   */
  getFieldError(fieldName: string): string | null {
    const messages = this.errors[fieldName];
    return messages && messages.length > 0 ? messages[0] : null;
  }

  /**
   * Check if a specific field has an error
   */
  hasFieldError(fieldName: string): boolean {
    return fieldName in this.errors && this.errors[fieldName].length > 0;
  }
}

export class HapioError extends Error {
  status: number;
  response?: any;

  constructor(message: string, status: number, response?: any) {
    super(message);
    this.name = 'HapioError';
    this.status = status;
    this.response = response;
  }
}

/**
 * Extract validation errors from Hapio API error response
 */
export function extractValidationErrors(error: any): HapioValidationError | null {
  if (error?.status === 422 && error?.response?.data?.errors) {
    const errors = error.response.data.errors;
    const message = error.response.data.message || 'Validation failed';
    return new HapioValidationError(message, 422, errors, error.response);
  }
  return null;
}

/**
 * Extract general error from Hapio API error response
 */
export function extractHapioError(error: any): HapioError | null {
  if (error?.status && error?.status !== 422) {
    const message = error?.message || `Hapio API error (${error.status})`;
    return new HapioError(message, error.status, error.response);
  }
  return null;
}

/**
 * Format error for UI display
 */
export function formatErrorForUI(error: any): {
  message: string;
  fieldErrors?: HapioValidationErrorField[];
  status?: number;
} {
  const validationError = extractValidationErrors(error);
  if (validationError) {
    return {
      message: validationError.message,
      fieldErrors: validationError.getFieldErrors(),
      status: validationError.status,
    };
  }

  const hapioError = extractHapioError(error);
  if (hapioError) {
    return {
      message: hapioError.message,
      status: hapioError.status,
    };
  }

  // Fallback for unknown errors
  return {
    message: error?.message || 'An unexpected error occurred',
    status: error?.status || 500,
  };
}

