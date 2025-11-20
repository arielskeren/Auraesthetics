/**
 * Request deduplication utility for Hapio API routes
 * Prevents duplicate concurrent requests to the same endpoint
 */

const inflightRequests = new Map<string, Promise<Response>>();

export function getCacheKey(parts: Record<string, string | number | null | undefined>): string {
  return Object.entries(parts)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .sort()
    .join('&');
}

export async function deduplicateRequest<T>(
  cacheKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if request is already in flight
  if (inflightRequests.has(cacheKey)) {
    const existingPromise = inflightRequests.get(cacheKey)!;
    // Wait for the existing request and return its result
    return existingPromise as Promise<T>;
  }

  // Create the request promise
  const promise = (async () => {
    try {
      return await fetcher();
    } finally {
      // Clean up after request completes
      inflightRequests.delete(cacheKey);
    }
  })();

  inflightRequests.set(cacheKey, promise as Promise<Response>);
  return promise;
}

