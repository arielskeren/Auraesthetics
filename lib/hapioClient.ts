import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const DEFAULT_BASE_URL = 'https://eu-central-1.hapio.net/v1';

const HAPIO_BASE_URL = process.env.HAPIO_BASE_URL ?? DEFAULT_BASE_URL;

// Lazy check: only validate token when actually making requests (not at module load time)
// This allows the module to be imported during build without requiring env vars
function getHapioApiToken(): string {
  const token = process.env.HAPIO_API_TOKEN;
  if (!token) {
    throw new Error('HAPIO_API_TOKEN is not configured.');
  }
  return token;
}

type HapioHttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

interface HapioPaginatedResponse<T> {
  data: T[];
  meta?: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from?: number | null;
    to?: number | null;
  };
  links?: Record<string, string | null>;
}

export interface HapioResourceSummary {
  id: string;
  name: string;
  max_simultaneous_bookings: number;
  metadata?: Record<string, unknown> | null;
  protected_metadata?: Record<string, unknown> | null;
  enabled: boolean;
}

export interface HapioBookableSlot {
  startsAt: string;
  endsAt: string;
  bufferStartsAt: string | null;
  bufferEndsAt: string | null;
  minEndsAt?: string | null;
  minBufferEndsAt?: string | null;
  resources: HapioResourceSummary[];
}

export interface HapioAvailabilityParams {
  serviceId: string;
  from: string;
  to: string;
  locationId?: string;
  perPage?: number;
  page?: number;
}

export interface HapioAvailabilityResponse {
  slots: HapioBookableSlot[];
  pagination?: {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
    from?: number | null;
    to?: number | null;
  };
}

export interface HapioBookingPayload {
  serviceId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  protectedMetadata?: Record<string, unknown>;
  isTemporary?: boolean;
  ignoreSchedule?: boolean;
  ignoreFullyBooked?: boolean;
  ignoreBookableSlots?: boolean;
}

export interface HapioBookingResponse {
  id: string;
  serviceId: string;
  locationId: string;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  bufferStartsAt: string | null;
  bufferEndsAt: string | null;
  isTemporary: boolean;
  isCanceled: boolean;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  canceledAt: string | null;
  metadata?: Record<string, unknown> | null;
  protectedMetadata?: Record<string, unknown> | null;
}

export interface HapioBookingUpdatePayload {
  startsAt?: string;
  endsAt?: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  protectedMetadata?: Record<string, unknown>;
  isTemporary?: boolean;
  ignoreSchedule?: boolean;
  ignoreFullyBooked?: boolean;
  ignoreBookableSlots?: boolean;
}

let client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (client) {
    return client;
  }

  // Check token only when creating the client (lazy validation)
  const token = getHapioApiToken();
  const baseURL = HAPIO_BASE_URL.endsWith('/') ? HAPIO_BASE_URL : `${HAPIO_BASE_URL}/`;

  client = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30_000,
  });

  return client;
}

async function sendRequest<T = any>(
  method: HapioHttpMethod,
  path: string,
  dataOrConfig?: any,
  maybeConfig?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const axiosClient = getClient();

  try {
    if (method === 'get' || method === 'delete') {
      return method === 'get'
        ? await axiosClient.get<T>(path, dataOrConfig)
        : await axiosClient.delete<T>(path, dataOrConfig);
    }

    if (method === 'post') {
      return await axiosClient.post<T>(path, dataOrConfig, maybeConfig);
    }

    if (method === 'put') {
      return await axiosClient.put<T>(path, dataOrConfig, maybeConfig);
    }

    return await axiosClient.patch<T>(path, dataOrConfig, maybeConfig);
  } catch (error: any) {
    // Enhance axios errors with more context
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      const message = typeof data === 'object' && data?.message
        ? data.message
        : `Hapio API error (${status})`;
      const enhancedError = new Error(message);
      (enhancedError as any).status = status;
      (enhancedError as any).response = error.response;
      throw enhancedError;
    }
    // Re-throw network errors or other non-axios errors
    throw error;
  }
}

async function requestJson<T>(
  method: HapioHttpMethod,
  path: string,
  payload?: any,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await sendRequest<T>(method, path, payload, config);
  return response.data;
}

export async function getAvailability(
  params: HapioAvailabilityParams
): Promise<HapioAvailabilityResponse> {
  const { serviceId, from, to, locationId, perPage, page } = params;

  const query: Record<string, string | number> = {
    from,
    to,
  };

  if (locationId) {
    query.location = locationId;
  }
  if (perPage) {
    query.per_page = perPage;
  }
  if (page) {
    query.page = page;
  }

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `services/${serviceId}/bookable-slots`,
    { params: query }
  );

  const slots: HapioBookableSlot[] = (response.data ?? []).map((slot: any) => ({
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
    bufferStartsAt: slot.buffer_starts_at ?? null,
    bufferEndsAt: slot.buffer_ends_at ?? null,
    minEndsAt: slot.min_ends_at ?? null,
    minBufferEndsAt: slot.min_buffer_ends_at ?? null,
    resources: Array.isArray(slot.resources)
      ? slot.resources.map((resource: any) => ({
          id: resource.id,
          name: resource.name,
          max_simultaneous_bookings: resource.max_simultaneous_bookings,
          metadata: resource.metadata ?? null,
          protected_metadata: resource.protected_metadata ?? null,
          enabled: Boolean(resource.enabled),
        }))
      : [],
  }));

  const pagination = response.meta
    ? {
        currentPage: response.meta.current_page,
        perPage: response.meta.per_page,
        total: response.meta.total,
        lastPage: response.meta.last_page,
        from: response.meta.from ?? null,
        to: response.meta.to ?? null,
      }
    : undefined;

  return {
    slots,
    pagination,
  };
}

export async function createPendingBooking(
  payload: HapioBookingPayload
): Promise<HapioBookingResponse> {
  const body: Record<string, unknown> = {
    location_id: payload.locationId,
    service_id: payload.serviceId,
    starts_at: payload.startsAt,
    ends_at: payload.endsAt,
  };

  if (payload.resourceId) {
    body.resource_id = payload.resourceId;
  }
  if (payload.metadata) {
    body.metadata = payload.metadata;
  }
  if (payload.protectedMetadata) {
    body.protected_metadata = payload.protectedMetadata;
  }
  if (typeof payload.isTemporary === 'boolean') {
    body.is_temporary = payload.isTemporary;
  } else {
    body.is_temporary = true;
  }
  if (typeof payload.ignoreSchedule === 'boolean') {
    body.ignore_schedule = payload.ignoreSchedule;
  }
  if (typeof payload.ignoreFullyBooked === 'boolean') {
    body.ignore_fully_booked = payload.ignoreFullyBooked;
  }
  if (typeof payload.ignoreBookableSlots === 'boolean') {
    body.ignore_bookable_slots = payload.ignoreBookableSlots;
  }

  return normalizeBooking(await requestJson<any>('post', 'bookings', body));
}

export async function confirmBooking(
  bookingId: string,
  payload: HapioBookingUpdatePayload = {}
): Promise<HapioBookingResponse> {
  const body: Record<string, unknown> = {};

  if (payload.startsAt) {
    body.starts_at = payload.startsAt;
  }
  if (payload.endsAt) {
    body.ends_at = payload.endsAt;
  }
  if (payload.resourceId !== undefined) {
    body.resource_id = payload.resourceId;
  }
  if (payload.metadata) {
    body.metadata = payload.metadata;
  }
  if (payload.protectedMetadata) {
    body.protected_metadata = payload.protectedMetadata;
  }
  if (typeof payload.ignoreSchedule === 'boolean') {
    body.ignore_schedule = payload.ignoreSchedule;
  }
  if (typeof payload.ignoreFullyBooked === 'boolean') {
    body.ignore_fully_booked = payload.ignoreFullyBooked;
  }
  if (typeof payload.ignoreBookableSlots === 'boolean') {
    body.ignore_bookable_slots = payload.ignoreBookableSlots;
  }

  body.is_temporary = false;

  return normalizeBooking(await requestJson<any>('patch', `bookings/${bookingId}`, body));
}

export async function rescheduleBooking(
  bookingId: string,
  payload: Required<Pick<HapioBookingUpdatePayload, 'startsAt' | 'endsAt'>> &
    Omit<HapioBookingUpdatePayload, 'startsAt' | 'endsAt'>
): Promise<HapioBookingResponse> {
  const body: Record<string, unknown> = {
    starts_at: payload.startsAt,
    ends_at: payload.endsAt,
  };

  if (payload.resourceId !== undefined) {
    body.resource_id = payload.resourceId;
  }
  if (payload.metadata) {
    body.metadata = payload.metadata;
  }
  if (payload.protectedMetadata) {
    body.protected_metadata = payload.protectedMetadata;
  }
  if (typeof payload.ignoreSchedule === 'boolean') {
    body.ignore_schedule = payload.ignoreSchedule;
  }
  if (typeof payload.ignoreFullyBooked === 'boolean') {
    body.ignore_fully_booked = payload.ignoreFullyBooked;
  }
  if (typeof payload.ignoreBookableSlots === 'boolean') {
    body.ignore_bookable_slots = payload.ignoreBookableSlots;
  }

  return normalizeBooking(await requestJson<any>('patch', `bookings/${bookingId}`, body));
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await requestJson('delete', `bookings/${bookingId}`);
}

function normalizeBooking(payload: any): HapioBookingResponse {
  const data = payload?.data ?? payload ?? {};

  return {
    id: data.id,
    serviceId: data.service_id,
    locationId: data.location_id,
    resourceId: data.resource_id ?? null,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    bufferStartsAt: data.buffer_starts_at ?? null,
    bufferEndsAt: data.buffer_ends_at ?? null,
    isTemporary: Boolean(data.is_temporary),
    isCanceled: Boolean(data.is_canceled),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    finalizedAt: data.finalized_at ?? null,
    canceledAt: data.canceled_at ?? null,
    metadata: data.metadata ?? null,
    protectedMetadata: data.protected_metadata ?? null,
  };
}

export function getRawHapioClient(): AxiosInstance {
  return getClient();
}


