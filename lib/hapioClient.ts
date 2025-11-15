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
  resourceId?: string;
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
      let message = typeof data === 'object' && data?.message
        ? data.message
        : `Hapio API error (${status})`;
      
      // Include validation errors if present
      if (typeof data === 'object' && data?.errors) {
        const errorDetails = typeof data.errors === 'object'
          ? JSON.stringify(data.errors, null, 2)
          : String(data.errors);
        console.error('[Hapio] Validation errors:', errorDetails);
        message += ` - Validation errors: ${errorDetails}`;
      }
      
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
  const { serviceId, from, to, locationId, resourceId, perPage, page } = params;

  const query: Record<string, string | number> = {
    from,
    to,
  };

  if (locationId) {
    query.location = locationId;
  }
  if (resourceId) {
    query.resource = resourceId;
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

  // Log raw response for debugging
  console.log('[Hapio] Raw bookable-slots response:', {
    hasData: !!response.data,
    dataLength: Array.isArray(response.data) ? response.data.length : 'not an array',
    dataType: typeof response.data,
    firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : null,
    meta: response.meta,
  });

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

// ============================================================================
// Hapio Management API Functions (for Admin Panel)
// ============================================================================

export interface HapioSchedule {
  id: string;
  resource_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface HapioResource {
  id: string;
  name: string;
  location_id: string;
  max_simultaneous_bookings: number;
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
  protected_metadata?: Record<string, unknown> | null;
}

export interface HapioLocation {
  id: string;
  name: string;
  address?: string | null;
  timezone?: string | null;
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface HapioService {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_before_minutes?: number | null;
  buffer_after_minutes?: number | null;
  enabled: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface HapioBlock {
  id: string;
  resource_id: string | null;
  location_id: string | null;
  starts_at: string;
  ends_at: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Get all resources for a location
export async function getResources(locationId?: string): Promise<HapioResource[]> {
  const query: Record<string, string> = {};
  if (locationId) {
    query.location_id = locationId;
  }
  
  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'resources',
    { params: query }
  );
  
  return (response.data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    location_id: r.location_id,
    max_simultaneous_bookings: r.max_simultaneous_bookings,
    enabled: Boolean(r.enabled),
    metadata: r.metadata ?? null,
    protected_metadata: r.protected_metadata ?? null,
  }));
}

// Get all locations
export async function getLocations(): Promise<HapioLocation[]> {
  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'locations'
  );
  
  return (response.data ?? []).map((l: any) => ({
    id: l.id,
    name: l.name,
    address: l.address ?? null,
    timezone: l.timezone ?? null,
    enabled: Boolean(l.enabled),
    metadata: l.metadata ?? null,
  }));
}

// Get all services
export async function getServices(): Promise<HapioService[]> {
  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'services'
  );
  
  return (response.data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    duration_minutes: s.duration_minutes,
    buffer_before_minutes: s.buffer_before_minutes ?? null,
    buffer_after_minutes: s.buffer_after_minutes ?? null,
    enabled: Boolean(s.enabled),
    metadata: s.metadata ?? null,
  }));
}

// Get schedules for a resource
export async function getSchedules(resourceId: string): Promise<HapioSchedule[]> {
  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `resources/${resourceId}/schedules`
  );
  
  return (response.data ?? []).map((s: any) => ({
    id: s.id,
    resource_id: s.resource_id,
    day_of_week: s.day_of_week,
    start_time: s.start_time,
    end_time: s.end_time,
    enabled: Boolean(s.enabled),
    metadata: s.metadata ?? null,
  }));
}

// Create a schedule
export async function createSchedule(resourceId: string, schedule: {
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<HapioSchedule> {
  const body: Record<string, unknown> = {
    day_of_week: schedule.day_of_week,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    enabled: schedule.enabled ?? true,
  };
  
  if (schedule.metadata) {
    body.metadata = schedule.metadata;
  }
  
  const response = await requestJson<any>(
    'post',
    `resources/${resourceId}/schedules`,
    body
  );
  
  return {
    id: response.id,
    resource_id: response.resource_id,
    day_of_week: response.day_of_week,
    start_time: response.start_time,
    end_time: response.end_time,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

// Update a schedule
export async function updateSchedule(
  resourceId: string,
  scheduleId: string,
  updates: Partial<Pick<HapioSchedule, 'start_time' | 'end_time' | 'enabled' | 'metadata'>>
): Promise<HapioSchedule> {
  const body: Record<string, unknown> = {};
  
  if (updates.start_time !== undefined) body.start_time = updates.start_time;
  if (updates.end_time !== undefined) body.end_time = updates.end_time;
  if (updates.enabled !== undefined) body.enabled = updates.enabled;
  if (updates.metadata !== undefined) body.metadata = updates.metadata;
  
  const response = await requestJson<any>(
    'patch',
    `resources/${resourceId}/schedules/${scheduleId}`,
    body
  );
  
  return {
    id: response.id,
    resource_id: response.resource_id,
    day_of_week: response.day_of_week,
    start_time: response.start_time,
    end_time: response.end_time,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

// Delete a schedule
export async function deleteSchedule(resourceId: string, scheduleId: string): Promise<void> {
  await requestJson('delete', `resources/${resourceId}/schedules/${scheduleId}`);
}

// Get blocks (unavailable times)
export async function getBlocks(params?: {
  resource_id?: string;
  location_id?: string;
  from?: string;
  to?: string;
}): Promise<HapioBlock[]> {
  const query: Record<string, string> = {};
  if (params?.resource_id) query.resource_id = params.resource_id;
  if (params?.location_id) query.location_id = params.location_id;
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  
  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'blocks',
    { params: query }
  );
  
  return (response.data ?? []).map((b: any) => ({
    id: b.id,
    resource_id: b.resource_id ?? null,
    location_id: b.location_id ?? null,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    reason: b.reason ?? null,
    metadata: b.metadata ?? null,
  }));
}

// Create a block
export async function createBlock(block: {
  resource_id?: string | null;
  location_id?: string | null;
  starts_at: string;
  ends_at: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}): Promise<HapioBlock> {
  const body: Record<string, unknown> = {
    starts_at: block.starts_at,
    ends_at: block.ends_at,
  };
  
  if (block.resource_id) body.resource_id = block.resource_id;
  if (block.location_id) body.location_id = block.location_id;
  if (block.reason) body.reason = block.reason;
  if (block.metadata) body.metadata = block.metadata;
  
  const response = await requestJson<any>('post', 'blocks', body);
  
  return {
    id: response.id,
    resource_id: response.resource_id ?? null,
    location_id: response.location_id ?? null,
    starts_at: response.starts_at,
    ends_at: response.ends_at,
    reason: response.reason ?? null,
    metadata: response.metadata ?? null,
  };
}

// Delete a block
export async function deleteBlock(blockId: string): Promise<void> {
  await requestJson('delete', `blocks/${blockId}`);
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


