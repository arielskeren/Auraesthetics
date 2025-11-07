import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const CAL_API_BASE_URL = 'https://api.cal.com/v2/';
const CAL_API_VERSION = '2024-09-04';
const MAX_REQUESTS_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;
const REMAINING_THRESHOLD = 70;
const PAUSE_DURATION_MS = 30_000;

let requestTimestamps: number[] = [];
let pauseUntil = 0;
let queue: Promise<void> = Promise.resolve();

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function ensureThrottle() {
  const now = Date.now();

  if (pauseUntil > now) {
    await sleep(pauseUntil - now);
  }

  requestTimestamps = requestTimestamps.filter((ts) => now - ts < RATE_WINDOW_MS);

  if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    const wait = RATE_WINDOW_MS - (now - requestTimestamps[0]);
    if (wait > 0) {
      await sleep(wait);
    }
  }
}

function pickHeaderNumber(headers: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = headers?.[key] ?? headers?.[key?.toLowerCase?.()] ?? headers?.[key?.toUpperCase?.()];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
  }
  return null;
}

function getRemainingFromHeaders(headers: Record<string, any>) {
  return pickHeaderNumber(headers, [
    'x-ratelimit-remaining',
    'x-ratelimit-remaining-default',
    'X-RateLimit-Remaining',
    'X-RateLimit-Remaining-Default',
  ]);
}

async function applyRateLimit(responseHeaders: Record<string, any>) {
  const now = Date.now();
  requestTimestamps.push(now);

  const remaining = getRemainingFromHeaders(responseHeaders);
  if (typeof remaining === 'number' && remaining > -1 && remaining < REMAINING_THRESHOLD) {
    pauseUntil = Math.max(pauseUntil, now + PAUSE_DURATION_MS);
  }
}

function createClient(): AxiosInstance {
  const apiKey = process.env.CAL_COM_API_KEY;
  if (!apiKey) {
    throw new Error('CAL_COM_API_KEY is not set');
  }

  const instance = axios.create({
    baseURL: CAL_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'cal-api-version': CAL_API_VERSION,
    },
  });

  instance.interceptors.request.use(async (config) => {
    queue = queue.then(ensureThrottle);
    await queue;
    return config;
  });

  instance.interceptors.response.use(
    async (response) => {
      await applyRateLimit(response.headers ?? {});
      return response;
    },
    async (error) => {
      await applyRateLimit(error?.response?.headers ?? {});
      throw error;
    }
  );

  return instance;
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!client) {
    client = createClient();
  }
  return client;
}

function sanitizePath(path: string) {
  return path.startsWith('/') ? path.slice(1) : path;
}

export function getCalRateLimitRemaining(headers: Record<string, any>) {
  const remaining = getRemainingFromHeaders(headers);
  return typeof remaining === 'number' ? remaining : null;
}

export function getCalRateLimitInfo(headers: Record<string, any>) {
  return {
    limit: pickHeaderNumber(headers, [
      'x-ratelimit-limit',
      'x-ratelimit-limit-default',
      'X-RateLimit-Limit',
      'X-RateLimit-Limit-Default',
    ]),
    remaining: getCalRateLimitRemaining(headers),
    reset: pickHeaderNumber(headers, [
      'x-ratelimit-reset',
      'x-ratelimit-reset-default',
      'X-RateLimit-Reset',
      'X-RateLimit-Reset-Default',
    ]),
  };
}

export async function calGet<T = any>(path: string, config?: AxiosRequestConfig) {
  const response = await getClient().get<T>(sanitizePath(path), config);
  return response.data;
}

export async function calPost<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
  const response = await getClient().post<T>(sanitizePath(path), data, config);
  return response.data;
}

export async function calPatch<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
  const response = await getClient().patch<T>(sanitizePath(path), data, config);
  return response.data;
}

export async function calDelete<T = any>(path: string, config?: AxiosRequestConfig) {
  const response = await getClient().delete<T>(sanitizePath(path), config);
  return response.data;
}

export function getCalClient() {
  return getClient();
}
