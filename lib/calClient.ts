const CAL_API_KEY = process.env.CAL_API_KEY || process.env.CAL_COM_API_KEY;
const CAL_API_VERSION_SLOTS = process.env.CAL_API_VERSION_SLOTS;
const CAL_API_VERSION_BOOKINGS = process.env.CAL_API_VERSION_BOOKINGS;

type CalApiFamily = 'slots' | 'bookings';

interface CalFetchInit extends RequestInit {
  family?: CalApiFamily;
}

const resolveFamily = (path: string, explicit?: CalApiFamily): CalApiFamily => {
  if (explicit) {
    return explicit;
  }
  return path.startsWith('slots') ? 'slots' : 'bookings';
};

const resolveVersion = (family: CalApiFamily) => {
  const version =
    family === 'slots' ? CAL_API_VERSION_SLOTS : CAL_API_VERSION_BOOKINGS;
  if (!version) {
    throw new Error(
      `Missing Cal.com API version for ${family}. Set CAL_API_VERSION_${family.toUpperCase()}.`
    );
  }
  return version;
};

export async function calFetch(
  path: string,
  body?: unknown,
  init?: CalFetchInit
): Promise<Response> {
  if (!CAL_API_KEY) {
    throw new Error('CAL_API_KEY is not configured.');
  }

  const family = resolveFamily(path, init?.family);
  const version = resolveVersion(family);
  const url = `https://api.cal.com/v2/${path}`;

  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${CAL_API_KEY}`);
  headers.set('cal-api-version', version);

  const fetchInit: RequestInit = {
    method: init?.method ?? (body ? 'POST' : 'GET'),
    ...init,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  };

  return fetch(url, fetchInit);
}

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const CAL_API_BASE_URL = 'https://api.cal.com/v2/';
const DEFAULT_CAL_API_VERSION = '2024-09-04';
const BOOKINGS_API_VERSION = '2024-08-13';
const EVENT_TYPES_API_VERSION = '2024-06-14';
const MAX_REQUESTS_PER_MINUTE = 60;
const RATE_WINDOW_MS = 60_000;
const REMAINING_THRESHOLD = 20;
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
  const apiKey = process.env.CAL_API_KEY || process.env.CAL_COM_API_KEY;
  if (!apiKey) {
    throw new Error('CAL_COM_API_KEY is not set');
  }

  const instance = axios.create({
    baseURL: CAL_API_BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
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

function hasVersionHeader(headers: Record<string, any>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === 'cal-api-version');
}

function resolveVersion(path: string): string {
  if (path.startsWith('bookings')) {
    return BOOKINGS_API_VERSION;
  }

  if (path.startsWith('event-types')) {
    return EVENT_TYPES_API_VERSION;
  }

  return DEFAULT_CAL_API_VERSION;
}

function prepareRequest(
  path: string,
  config?: AxiosRequestConfig
): { preparedPath: string; preparedConfig: AxiosRequestConfig | undefined } {
  const preparedPath = sanitizePath(path);

  const headers = { ...(config?.headers ?? {}) };
  if (!hasVersionHeader(headers)) {
    headers['cal-api-version'] = resolveVersion(preparedPath);
  }

  const preparedConfig = config ? { ...config, headers } : { headers };
  return { preparedPath, preparedConfig };
}

type CalMethod = 'get' | 'post' | 'patch' | 'delete';

async function sendCalRequest<T = any>(
  method: CalMethod,
  path: string,
  dataOrConfig?: any,
  maybeConfig?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const axiosClient = getClient();

  if (method === 'get' || method === 'delete') {
    const { preparedPath, preparedConfig } = prepareRequest(path, dataOrConfig);
    return method === 'get'
      ? axiosClient.get<T>(preparedPath, preparedConfig)
      : axiosClient.delete<T>(preparedPath, preparedConfig);
  }

  const { preparedPath, preparedConfig } = prepareRequest(path, maybeConfig);
  return method === 'post'
    ? axiosClient.post<T>(preparedPath, dataOrConfig, preparedConfig)
    : axiosClient.patch<T>(preparedPath, dataOrConfig, preparedConfig);
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

function unwrapData<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
}

export async function calGet<T = any>(path: string, config?: AxiosRequestConfig) {
  const response = await sendCalRequest<T>('get', path, config);
  return unwrapData<T>(response.data);
}

export async function calPost<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
  const response = await sendCalRequest<T>('post', path, data, config);
  return unwrapData<T>(response.data);
}

export async function calPatch<T = any>(path: string, data?: any, config?: AxiosRequestConfig) {
  const response = await sendCalRequest<T>('patch', path, data, config);
  return unwrapData<T>(response.data);
}

export async function calDelete<T = any>(path: string, config?: AxiosRequestConfig) {
  const response = await sendCalRequest<T>('delete', path, config);
  return unwrapData<T>(response.data);
}

export async function calRequest<T = any>(
  method: 'get',
  path: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>>;

export async function calRequest<T = any>(
  method: 'delete',
  path: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>>;

export async function calRequest<T = any>(
  method: 'post' | 'patch',
  path: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>>;

export async function calRequest<T = any>(
  method: CalMethod,
  path: string,
  dataOrConfig?: any,
  maybeConfig?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  return sendCalRequest<T>(method, path, dataOrConfig, maybeConfig);
}

export function getCalClient() {
  return getClient();
}
