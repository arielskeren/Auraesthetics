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
let lastToken: string | null = null;

function getClient(): AxiosInstance {
  // Check token only when creating the client (lazy validation)
  const token = getHapioApiToken();
  const baseURL = HAPIO_BASE_URL.endsWith('/') ? HAPIO_BASE_URL : `${HAPIO_BASE_URL}/`;

  // Recreate client if token changed (for testing new tokens)
  if (!client || lastToken !== token) {
    console.log('[Hapio Client] Creating new axios client', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenChanged: lastToken !== token,
      baseURL,
    });

    client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30_000,
    });

    lastToken = token;
  }

  return client;
}

async function sendRequest<T = any>(
  method: HapioHttpMethod,
  path: string,
  dataOrConfig?: any,
  maybeConfig?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  const axiosClient = getClient();
  const token = getHapioApiToken();

  // Log request details for debugging
  console.log(`[Hapio API] ${method.toUpperCase()} ${path}`, {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenPrefix: token ? `${token.substring(0, 8)}...` : 'none',
    hasData: !!dataOrConfig,
  });

  try {
    let response: AxiosResponse<T>;
    
    if (method === 'get' || method === 'delete') {
      response = method === 'get'
        ? await axiosClient.get<T>(path, dataOrConfig)
        : await axiosClient.delete<T>(path, dataOrConfig);
    } else if (method === 'post') {
      response = await axiosClient.post<T>(path, dataOrConfig, maybeConfig);
    } else if (method === 'put') {
      response = await axiosClient.put<T>(path, dataOrConfig, maybeConfig);
    } else {
      response = await axiosClient.patch<T>(path, dataOrConfig, maybeConfig);
    }

    console.log(`[Hapio API] ${method.toUpperCase()} ${path} - Success (${response.status})`);
    return response;
  } catch (error: any) {
    // Enhance axios errors with more context
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.error(`[Hapio API] ${method.toUpperCase()} ${path} - Error ${status}`, {
        status,
        statusText: error.response.statusText,
        data,
        headers: error.response.headers,
        hasToken: !!token,
      });
      
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
      
      // Special handling for 401 Unauthorized
      if (status === 401) {
        console.error('[Hapio API] 401 Unauthorized - Check HAPIO_API_TOKEN:', {
          tokenExists: !!token,
          tokenLength: token?.length || 0,
          baseURL: HAPIO_BASE_URL,
        });
        message = `Authentication failed (401). Please check your HAPIO_API_TOKEN is valid and has the correct permissions.`;
      }
      
      const enhancedError = new Error(message);
      (enhancedError as any).status = status;
      (enhancedError as any).response = error.response;
      throw enhancedError;
    }
    
    // Network or other errors
    console.error(`[Hapio API] ${method.toUpperCase()} ${path} - Network/Other error:`, error.message);
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
  address?: string | null; // Deprecated: use address fields below
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
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

// ============================================================================
// Phase 1: Complete Hapio Management API Functions
// Following official Hapio API documentation at https://docs.hapio.io
// ============================================================================

// ============================================================================
// Project Management
// ============================================================================

export interface HapioProject {
  id: string;
  name: string;
  timezone?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export async function getCurrentProject(): Promise<HapioProject> {
  const response = await requestJson<any>('get', 'project');
  return {
    id: response.id,
    name: response.name,
    timezone: response.timezone ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

// ============================================================================
// Locations Management
// ============================================================================

export interface HapioLocationPayload {
  name: string;
  address?: string | null; // Deprecated: use address fields below
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  timezone?: string | null;
  enabled?: boolean;
  metadata?: Record<string, unknown> | null;
}

export async function listLocations(params?: {
  page?: number;
  per_page?: number;
}): Promise<HapioPaginatedResponse<HapioLocation>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'locations',
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((l: any) => {
      // Note: Address fields are NOT stored in Hapio - they're managed separately
      return {
        id: l.id,
        name: l.name,
        address: null, // Address fields not supported by Hapio
        street1: null,
        street2: null,
        city: null,
        state: null,
        country: null,
        zip: null,
        timezone: l.time_zone ?? l.timezone ?? null, // Map time_zone to timezone
        enabled: Boolean(l.enabled),
        metadata: l.metadata ?? null,
      };
    }),
  };
}

export async function getLocation(id: string): Promise<HapioLocation> {
  const response = await requestJson<any>('get', `locations/${id}`);
  // Note: Address fields are NOT stored in Hapio - they're managed separately
  return {
    id: response.id,
    name: response.name,
    address: null, // Address fields not supported by Hapio
    street1: null,
    street2: null,
    city: null,
    state: null,
    country: null,
    zip: null,
    timezone: response.time_zone ?? response.timezone ?? null, // Map time_zone to timezone
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function createLocation(location: HapioLocationPayload): Promise<HapioLocation> {
  const body: Record<string, unknown> = {
    name: location.name,
  };
  
  // Note: Address fields are NOT sent to Hapio - they're managed separately
  
  // Handle timezone: convert empty strings to null, omit if undefined
  // Hapio API uses time_zone (snake_case) in responses, but may accept timezone (camelCase) in requests
  // Try both formats to ensure compatibility
  if (location.timezone !== undefined) {
    const timezoneValue = location.timezone === '' ? null : location.timezone;
    body.time_zone = timezoneValue; // Hapio expects time_zone in requests
    // Also include timezone for backwards compatibility
    body.timezone = timezoneValue;
  }
  
  if (location.enabled !== undefined) body.enabled = location.enabled;
  
  // Handle metadata (address fields are NOT stored in Hapio - they're managed separately)
  if (location.metadata !== undefined) body.metadata = location.metadata;

  console.log('[Hapio Client] Creating location:', {
    originalInput: location,
    transformedBody: body,
    emptyStringNormalized: {
      street1: location.street1 === '' ? 'converted to null' : 'unchanged',
      street2: location.street2 === '' ? 'converted to null' : 'unchanged',
      city: location.city === '' ? 'converted to null' : 'unchanged',
      state: location.state === '' ? 'converted to null' : 'unchanged',
      country: location.country === '' ? 'converted to null' : 'unchanged',
      zip: location.zip === '' ? 'converted to null' : 'unchanged',
      address: location.address === '' ? 'converted to null' : 'unchanged',
      timezone: location.timezone === '' ? 'converted to null' : 'unchanged',
    },
  });

  const response = await requestJson<any>('post', 'locations', body);
  
  console.log('[Hapio Client] Location created (raw):', {
    id: response.id,
    name: response.name,
    time_zone: response.time_zone,
    timezone: response.timezone,
    enabled: response.enabled,
  });
  
  // Note: Address fields are NOT stored in Hapio - they're managed separately
  return {
    id: response.id,
    name: response.name,
    address: null, // Address fields not supported by Hapio
    street1: null,
    street2: null,
    city: null,
    state: null,
    country: null,
    zip: null,
    timezone: response.time_zone ?? response.timezone ?? null, // Map time_zone to timezone
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function updateLocation(
  id: string,
  location: Partial<HapioLocationPayload>
): Promise<HapioLocation> {
  const body: Record<string, unknown> = {};
  
  // Handle name (required field)
  if (location.name !== undefined) body.name = location.name;
  
  // Note: Address fields are NOT sent to Hapio - they're managed separately
  
  // Handle timezone: convert empty strings to null, omit if undefined
  // Hapio API uses time_zone (snake_case) in responses, but may accept timezone (camelCase) in requests
  // Try both formats to ensure compatibility
  if (location.timezone !== undefined) {
    const timezoneValue = location.timezone === '' ? null : location.timezone;
    body.time_zone = timezoneValue; // Hapio expects time_zone in requests
    // Also include timezone for backwards compatibility
    body.timezone = timezoneValue;
  }
  
  // Handle enabled
  if (location.enabled !== undefined) body.enabled = location.enabled;
  
  // Handle metadata (address fields are NOT stored in Hapio - they're managed separately)
  if (location.metadata !== undefined) body.metadata = location.metadata;

  console.log('[Hapio Client] Updating location:', {
    id,
    originalInput: location,
    transformedBody: body,
    bodyKeys: Object.keys(body),
    bodyValues: Object.values(body),
    emptyStringNormalized: {
      street1: location.street1 === '' ? 'converted to null' : 'unchanged',
      street2: location.street2 === '' ? 'converted to null' : 'unchanged',
      city: location.city === '' ? 'converted to null' : 'unchanged',
      state: location.state === '' ? 'converted to null' : 'unchanged',
      country: location.country === '' ? 'converted to null' : 'unchanged',
      zip: location.zip === '' ? 'converted to null' : 'unchanged',
      address: location.address === '' ? 'converted to null' : 'unchanged',
      timezone: location.timezone === '' ? 'converted to null' : 'unchanged',
    },
  });

  const response = await requestJson<any>('patch', `locations/${id}`, body);
  
  // Hapio returns time_zone (snake_case) but we use timezone (camelCase)
  // Map the response fields correctly
  // Note: Address fields are NOT stored in Hapio - they're managed separately
  const mappedResponse = {
    id: response.id,
    name: response.name,
    address: null, // Address fields not supported by Hapio
    street1: null,
    street2: null,
    city: null,
    state: null,
    country: null,
    zip: null,
    timezone: response.time_zone ?? response.timezone ?? null, // Support both formats
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
  
  // Compare request vs response to detect mismatches
  const requestResponseComparison = {
    street1: {
      requested: body.street1 ?? body.street_1 ?? body.address_line_1,
      received: mappedResponse.street1,
      match: (body.street1 ?? body.street_1 ?? body.address_line_1) === mappedResponse.street1,
    },
    city: {
      requested: body.city,
      received: mappedResponse.city,
      match: body.city === mappedResponse.city,
    },
    state: {
      requested: body.state,
      received: mappedResponse.state,
      match: body.state === mappedResponse.state,
    },
    zip: {
      requested: body.zip ?? body.postal_code ?? body.zip_code,
      received: mappedResponse.zip,
      match: (body.zip ?? body.postal_code ?? body.zip_code) === mappedResponse.zip,
    },
    address: {
      requested: body.address,
      received: mappedResponse.address,
      match: body.address === mappedResponse.address,
    },
    timezone: {
      requested: body.time_zone ?? body.timezone,
      received: mappedResponse.timezone,
      match: (body.time_zone ?? body.timezone) === mappedResponse.timezone,
    },
    name: {
      requested: body.name,
      received: mappedResponse.name,
      match: body.name === mappedResponse.name,
    },
    enabled: {
      requested: body.enabled,
      received: mappedResponse.enabled,
      match: body.enabled === mappedResponse.enabled,
    },
  };
  
  console.log('[Hapio Client] Location update response (raw):', {
    id: response.id,
    name: response.name,
    address: response.address,
    street1: response.street1 ?? response.street_1 ?? response.address_line_1,
    street2: response.street2 ?? response.street_2 ?? response.address_line_2,
    city: response.city,
    state: response.state,
    country: response.country,
    zip: response.zip ?? response.postal_code ?? response.zip_code,
    time_zone: response.time_zone,
    timezone: response.timezone,
    enabled: response.enabled,
    fullResponse: response,
  });
  
  console.log('[Hapio Client] Location update response (mapped):', mappedResponse);
  
  console.log('[Hapio Client] Request vs Response comparison:', requestResponseComparison);
  
  // Log any mismatches
  const mismatches = Object.entries(requestResponseComparison)
    .filter(([_, comparison]) => !comparison.match)
    .map(([field, comparison]) => ({ field, ...comparison }));
  
  if (mismatches.length > 0) {
    console.warn('[Hapio Client] Field mismatches detected:', mismatches);
    console.warn('[Hapio Client] Note: Hapio may not support the address field, or timezone may be stored as time_zone');
  }
  
  return mappedResponse;
}

export async function replaceLocation(
  id: string,
  location: HapioLocationPayload
): Promise<HapioLocation> {
  const body: Record<string, unknown> = {
    name: location.name,
  };
  
  // Note: Address fields are NOT sent to Hapio - they're managed separately
  
  // Handle timezone: convert empty strings to null, omit if undefined
  // Hapio API uses time_zone (snake_case) in responses, but may accept timezone (camelCase) in requests
  // Try both formats to ensure compatibility
  if (location.timezone !== undefined) {
    const timezoneValue = location.timezone === '' ? null : location.timezone;
    body.time_zone = timezoneValue; // Hapio expects time_zone in requests
    // Also include timezone for backwards compatibility
    body.timezone = timezoneValue;
  }
  
  if (location.enabled !== undefined) body.enabled = location.enabled;
  
  // Handle metadata
  // Since Hapio doesn't support address fields directly, store them in metadata as a workaround
  const addressMetadata: Record<string, unknown> = {};
  if (location.street1 !== undefined) addressMetadata.street1 = location.street1 === '' ? null : location.street1;
  if (location.street2 !== undefined) addressMetadata.street2 = location.street2 === '' ? null : location.street2;
  if (location.city !== undefined) addressMetadata.city = location.city === '' ? null : location.city;
  if (location.state !== undefined) addressMetadata.state = location.state === '' ? null : location.state;
  if (location.country !== undefined) addressMetadata.country = location.country === '' ? null : location.country;
  if (location.zip !== undefined) addressMetadata.zip = location.zip === '' ? null : location.zip;
  if (location.address !== undefined) addressMetadata.address = location.address === '' ? null : location.address;
  
  // Merge address metadata with existing metadata
  if (Object.keys(addressMetadata).length > 0) {
    body.metadata = {
      ...(location.metadata || {}),
      ...addressMetadata,
    };
  } else if (location.metadata !== undefined) {
    body.metadata = location.metadata;
  }

  console.log('[Hapio Client] Replacing location:', {
    id,
    originalInput: location,
    transformedBody: body,
    emptyStringNormalized: {
      street1: location.street1 === '' ? 'converted to null' : 'unchanged',
      street2: location.street2 === '' ? 'converted to null' : 'unchanged',
      city: location.city === '' ? 'converted to null' : 'unchanged',
      state: location.state === '' ? 'converted to null' : 'unchanged',
      country: location.country === '' ? 'converted to null' : 'unchanged',
      zip: location.zip === '' ? 'converted to null' : 'unchanged',
      address: location.address === '' ? 'converted to null' : 'unchanged',
      timezone: location.timezone === '' ? 'converted to null' : 'unchanged',
    },
  });

  const response = await requestJson<any>('put', `locations/${id}`, body);
  
  console.log('[Hapio Client] Location replaced (raw):', {
    id: response.id,
    name: response.name,
    time_zone: response.time_zone,
    timezone: response.timezone,
    enabled: response.enabled,
  });
  
  // Note: Address fields are NOT stored in Hapio - they're managed separately
  return {
    id: response.id,
    name: response.name,
    address: null, // Address fields not supported by Hapio
    street1: null,
    street2: null,
    city: null,
    state: null,
    country: null,
    zip: null,
    timezone: response.time_zone ?? response.timezone ?? null, // Map time_zone to timezone
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function deleteLocation(id: string): Promise<void> {
  await requestJson('delete', `locations/${id}`);
}

// ============================================================================
// Resources Management
// ============================================================================

export interface HapioResourcePayload {
  name: string;
  location_id: string;
  max_simultaneous_bookings?: number;
  enabled?: boolean;
  metadata?: Record<string, unknown> | null;
  protected_metadata?: Record<string, unknown> | null;
}

export async function listResources(params?: {
  location_id?: string;
  page?: number;
  per_page?: number;
}): Promise<HapioPaginatedResponse<HapioResource>> {
  const query: Record<string, string | number> = {};
  if (params?.location_id) query.location_id = params.location_id;
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'resources',
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((r: any) => ({
      id: r.id,
      name: r.name,
      location_id: r.location_id,
      max_simultaneous_bookings: r.max_simultaneous_bookings,
      enabled: Boolean(r.enabled),
      metadata: r.metadata ?? null,
      protected_metadata: r.protected_metadata ?? null,
    })),
  };
}

export async function getResource(id: string): Promise<HapioResource> {
  const response = await requestJson<any>('get', `resources/${id}`);
  return {
    id: response.id,
    name: response.name,
    location_id: response.location_id,
    max_simultaneous_bookings: response.max_simultaneous_bookings,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
    protected_metadata: response.protected_metadata ?? null,
  };
}

export async function createResource(resource: HapioResourcePayload): Promise<HapioResource> {
  const body: Record<string, unknown> = {
    name: resource.name,
    location_id: resource.location_id,
  };
  if (resource.max_simultaneous_bookings !== undefined)
    body.max_simultaneous_bookings = resource.max_simultaneous_bookings;
  if (resource.enabled !== undefined) body.enabled = resource.enabled;
  if (resource.metadata !== undefined) body.metadata = resource.metadata;
  if (resource.protected_metadata !== undefined) body.protected_metadata = resource.protected_metadata;

  const response = await requestJson<any>('post', 'resources', body);
  return {
    id: response.id,
    name: response.name,
    location_id: response.location_id,
    max_simultaneous_bookings: response.max_simultaneous_bookings,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
    protected_metadata: response.protected_metadata ?? null,
  };
}

export async function updateResource(
  id: string,
  resource: Partial<HapioResourcePayload>
): Promise<HapioResource> {
  const body: Record<string, unknown> = {};
  if (resource.name !== undefined) body.name = resource.name;
  if (resource.location_id !== undefined) {
    // Only include location_id if it's a non-empty string
    if (resource.location_id && typeof resource.location_id === 'string' && resource.location_id.trim() !== '') {
      body.location_id = resource.location_id;
    } else if (resource.location_id === null || resource.location_id === '') {
      // Explicitly set to null if empty string or null
      body.location_id = null;
    }
  }
  if (resource.max_simultaneous_bookings !== undefined)
    body.max_simultaneous_bookings = resource.max_simultaneous_bookings;
  if (resource.enabled !== undefined) body.enabled = resource.enabled;
  if (resource.metadata !== undefined) body.metadata = resource.metadata;
  if (resource.protected_metadata !== undefined) body.protected_metadata = resource.protected_metadata;

  console.log('[Hapio] Updating resource with body:', {
    resourceId: id,
    ...body,
    location_id: body.location_id,
    location_id_type: typeof body.location_id,
    location_id_length: body.location_id ? String(body.location_id).length : 0,
    bodyKeys: Object.keys(body),
  });

  const response = await requestJson<any>('patch', `resources/${id}`, body);
  return {
    id: response.id,
    name: response.name,
    location_id: response.location_id,
    max_simultaneous_bookings: response.max_simultaneous_bookings,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
    protected_metadata: response.protected_metadata ?? null,
  };
}

export async function replaceResource(
  id: string,
  resource: HapioResourcePayload
): Promise<HapioResource> {
  const body: Record<string, unknown> = {
    name: resource.name,
    location_id: resource.location_id,
  };
  if (resource.max_simultaneous_bookings !== undefined)
    body.max_simultaneous_bookings = resource.max_simultaneous_bookings;
  if (resource.enabled !== undefined) body.enabled = resource.enabled;
  if (resource.metadata !== undefined) body.metadata = resource.metadata;
  if (resource.protected_metadata !== undefined) body.protected_metadata = resource.protected_metadata;

  const response = await requestJson<any>('put', `resources/${id}`, body);
  return {
    id: response.id,
    name: response.name,
    location_id: response.location_id,
    max_simultaneous_bookings: response.max_simultaneous_bookings,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
    protected_metadata: response.protected_metadata ?? null,
  };
}

export async function deleteResource(id: string): Promise<void> {
  await requestJson('delete', `resources/${id}`);
}

export async function listResourceSchedule(
  resourceId: string,
  params?: {
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  }
): Promise<HapioPaginatedResponse<any>> {
  const query: Record<string, string | number> = {};
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  return await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `resources/${resourceId}/schedule`,
    { params: query }
  );
}

export async function listResourceFullyBooked(
  resourceId: string,
  params?: {
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  }
): Promise<HapioPaginatedResponse<any>> {
  const query: Record<string, string | number> = {};
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  return await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `resources/${resourceId}/fully-booked`,
    { params: query }
  );
}

export interface HapioResourceServiceAssociation {
  resource_id: string;
  service_id: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export async function listResourceAssociatedServices(
  resourceId: string
): Promise<HapioResourceServiceAssociation[]> {
  const response = await requestJson<any[]>('get', `resources/${resourceId}/services`);
  return response.map((assoc: any) => ({
    resource_id: assoc.resource_id,
    service_id: assoc.service_id,
    metadata: assoc.metadata ?? null,
    created_at: assoc.created_at,
    updated_at: assoc.updated_at,
  }));
}

export async function getResourceServiceAssociation(
  resourceId: string,
  serviceId: string
): Promise<HapioResourceServiceAssociation> {
  const response = await requestJson<any>('get', `resources/${resourceId}/services/${serviceId}`);
  return {
    resource_id: response.resource_id,
    service_id: response.service_id,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function associateResourceService(
  resourceId: string,
  serviceId: string
): Promise<HapioResourceServiceAssociation> {
  const response = await requestJson<any>(
    'post',
    `resources/${resourceId}/services/${serviceId}`
  );
  return {
    resource_id: response.resource_id,
    service_id: response.service_id,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function dissociateResourceService(
  resourceId: string,
  serviceId: string
): Promise<void> {
  await requestJson('delete', `resources/${resourceId}/services/${serviceId}`);
}

// ============================================================================
// Services Management
// ============================================================================

export interface HapioServicePayload {
  name: string;
  duration_minutes: number;
  buffer_before_minutes?: number | null;
  buffer_after_minutes?: number | null;
  enabled?: boolean;
  metadata?: Record<string, unknown> | null;
}

export async function listServices(params?: {
  page?: number;
  per_page?: number;
}): Promise<HapioPaginatedResponse<HapioService>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'services',
    { params: query }
  );

  console.log('[Hapio] Raw services response:', {
    dataCount: response.data?.length || 0,
    firstServiceRaw: response.data?.[0],
    allServicesRaw: response.data,
  });

  const mapped = {
    ...response,
    data: response.data.map((s: any) => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes ?? null,
      buffer_before_minutes: s.buffer_before_minutes ?? null,
      buffer_after_minutes: s.buffer_after_minutes ?? null,
      enabled: Boolean(s.enabled),
      metadata: s.metadata ?? null,
    })),
  };

  console.log('[Hapio] Mapped services:', {
    firstServiceMapped: mapped.data?.[0],
  });

  return mapped;
}

export async function getService(id: string): Promise<HapioService> {
  const response = await requestJson<any>('get', `services/${id}`);
  return {
    id: response.id,
    name: response.name,
    duration_minutes: response.duration_minutes,
    buffer_before_minutes: response.buffer_before_minutes ?? null,
    buffer_after_minutes: response.buffer_after_minutes ?? null,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function createService(service: HapioServicePayload): Promise<HapioService> {
  const body: Record<string, unknown> = {
    name: service.name,
    duration_minutes: service.duration_minutes,
  };
  if (service.buffer_before_minutes !== undefined)
    body.buffer_before_minutes = service.buffer_before_minutes;
  if (service.buffer_after_minutes !== undefined)
    body.buffer_after_minutes = service.buffer_after_minutes;
  if (service.enabled !== undefined) body.enabled = service.enabled;
  if (service.metadata !== undefined) body.metadata = service.metadata;

  const response = await requestJson<any>('post', 'services', body);
  return {
    id: response.id,
    name: response.name,
    duration_minutes: response.duration_minutes,
    buffer_before_minutes: response.buffer_before_minutes ?? null,
    buffer_after_minutes: response.buffer_after_minutes ?? null,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function updateService(
  id: string,
  service: Partial<HapioServicePayload>
): Promise<HapioService> {
  const body: Record<string, unknown> = {};
  if (service.name !== undefined) body.name = service.name;
  if (service.duration_minutes !== undefined) body.duration_minutes = service.duration_minutes;
  if (service.buffer_before_minutes !== undefined)
    body.buffer_before_minutes = service.buffer_before_minutes;
  if (service.buffer_after_minutes !== undefined)
    body.buffer_after_minutes = service.buffer_after_minutes;
  if (service.enabled !== undefined) body.enabled = service.enabled;
  if (service.metadata !== undefined) body.metadata = service.metadata;

  const response = await requestJson<any>('patch', `services/${id}`, body);
  return {
    id: response.id,
    name: response.name,
    duration_minutes: response.duration_minutes,
    buffer_before_minutes: response.buffer_before_minutes ?? null,
    buffer_after_minutes: response.buffer_after_minutes ?? null,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function replaceService(
  id: string,
  service: HapioServicePayload
): Promise<HapioService> {
  const body: Record<string, unknown> = {
    name: service.name,
    duration_minutes: service.duration_minutes,
  };
  if (service.buffer_before_minutes !== undefined)
    body.buffer_before_minutes = service.buffer_before_minutes;
  if (service.buffer_after_minutes !== undefined)
    body.buffer_after_minutes = service.buffer_after_minutes;
  if (service.enabled !== undefined) body.enabled = service.enabled;
  if (service.metadata !== undefined) body.metadata = service.metadata;

  const response = await requestJson<any>('put', `services/${id}`, body);
  return {
    id: response.id,
    name: response.name,
    duration_minutes: response.duration_minutes,
    buffer_before_minutes: response.buffer_before_minutes ?? null,
    buffer_after_minutes: response.buffer_after_minutes ?? null,
    enabled: Boolean(response.enabled),
    metadata: response.metadata ?? null,
  };
}

export async function deleteService(id: string): Promise<void> {
  await requestJson('delete', `services/${id}`);
}

export async function listServiceBookableSlots(
  serviceId: string,
  params: {
    from: string;
    to: string;
    location_id?: string;
    resource_id?: string;
    per_page?: number;
    page?: number;
  }
): Promise<HapioPaginatedResponse<HapioBookableSlot>> {
  const query: Record<string, string | number> = {
    from: params.from,
    to: params.to,
  };
  if (params.location_id) query.location = params.location_id;
  if (params.resource_id) query.resource = params.resource_id;
  if (params.per_page) query.per_page = params.per_page;
  if (params.page) query.page = params.page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `services/${serviceId}/bookable-slots`,
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((slot: any) => ({
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
    })),
  };
}

export async function listServiceAssociatedResources(
  serviceId: string
): Promise<HapioResourceServiceAssociation[]> {
  const response = await requestJson<any[]>('get', `services/${serviceId}/resources`);
  return response.map((assoc: any) => ({
    resource_id: assoc.resource_id,
    service_id: assoc.service_id,
    metadata: assoc.metadata ?? null,
    created_at: assoc.created_at,
    updated_at: assoc.updated_at,
  }));
}

export async function getServiceResourceAssociation(
  serviceId: string,
  resourceId: string
): Promise<HapioResourceServiceAssociation> {
  const response = await requestJson<any>('get', `services/${serviceId}/resources/${resourceId}`);
  return {
    resource_id: response.resource_id,
    service_id: response.service_id,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function associateServiceResource(
  serviceId: string,
  resourceId: string
): Promise<HapioResourceServiceAssociation> {
  const response = await requestJson<any>(
    'post',
    `services/${serviceId}/resources/${resourceId}`
  );
  return {
    resource_id: response.resource_id,
    service_id: response.service_id,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function dissociateServiceResource(
  serviceId: string,
  resourceId: string
): Promise<void> {
  await requestJson('delete', `services/${serviceId}/resources/${resourceId}`);
}

// ============================================================================
// Schedule Blocks Management
// ============================================================================

export interface HapioScheduleBlock {
  id: string;
  starts_at: string;
  ends_at: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface HapioScheduleBlockPayload {
  starts_at: string;
  ends_at: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Build parent path for schedule blocks
 * Examples: "project", "locations/{locationId}", "resources/{resourceId}"
 */
function buildScheduleParentPath(parentType: 'project' | 'location' | 'resource', parentId?: string): string {
  if (parentType === 'project') {
    return 'project';
  }
  if (parentType === 'location' && parentId) {
    return `locations/${parentId}`;
  }
  if (parentType === 'resource' && parentId) {
    return `resources/${parentId}`;
  }
  throw new Error(`Invalid parent type/id combination: ${parentType}/${parentId}`);
}

export async function listScheduleBlocks(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  params?: {
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
  }
): Promise<HapioPaginatedResponse<HapioScheduleBlock>> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const query: Record<string, string | number> = {};
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `${parentPath}/schedule-blocks`,
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((block: any) => ({
      id: block.id,
      starts_at: block.starts_at,
      ends_at: block.ends_at,
      metadata: block.metadata ?? null,
      created_at: block.created_at,
      updated_at: block.updated_at,
    })),
  };
}

export async function getScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string
): Promise<HapioScheduleBlock> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const response = await requestJson<any>('get', `${parentPath}/schedule-blocks/${id}`);
  return {
    id: response.id,
    starts_at: response.starts_at,
    ends_at: response.ends_at,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function createScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  block: HapioScheduleBlockPayload
): Promise<HapioScheduleBlock> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const body: Record<string, unknown> = {
    starts_at: block.starts_at,
    ends_at: block.ends_at,
  };
  if (block.metadata !== undefined) body.metadata = block.metadata;

  const response = await requestJson<any>('post', `${parentPath}/schedule-blocks`, body);
  return {
    id: response.id,
    starts_at: response.starts_at,
    ends_at: response.ends_at,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function updateScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  block: Partial<HapioScheduleBlockPayload>
): Promise<HapioScheduleBlock> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const body: Record<string, unknown> = {};
  if (block.starts_at !== undefined) body.starts_at = block.starts_at;
  if (block.ends_at !== undefined) body.ends_at = block.ends_at;
  if (block.metadata !== undefined) body.metadata = block.metadata;

  const response = await requestJson<any>('patch', `${parentPath}/schedule-blocks/${id}`, body);
  return {
    id: response.id,
    starts_at: response.starts_at,
    ends_at: response.ends_at,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function replaceScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  block: HapioScheduleBlockPayload
): Promise<HapioScheduleBlock> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const body: Record<string, unknown> = {
    starts_at: block.starts_at,
    ends_at: block.ends_at,
  };
  if (block.metadata !== undefined) body.metadata = block.metadata;

  const response = await requestJson<any>('put', `${parentPath}/schedule-blocks/${id}`, body);
  return {
    id: response.id,
    starts_at: response.starts_at,
    ends_at: response.ends_at,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function deleteScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string
): Promise<void> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  await requestJson('delete', `${parentPath}/schedule-blocks/${id}`);
}

// ============================================================================
// Recurring Schedules Management
// ============================================================================

export interface HapioRecurringSchedule {
  id: string;
  start_date?: string | null; // YYYY-MM-DD format
  end_date?: string | null; // YYYY-MM-DD format
  interval?: number | null; // Recurrence interval (e.g., 1 for weekly)
  location?: {
    id: string;
    name?: string | null;
    time_zone?: string | null;
    enabled?: boolean;
  } | null;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface HapioRecurringSchedulePayload {
  name?: string | null;
  location_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function listRecurringSchedules(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  params?: {
    page?: number;
    per_page?: number;
  }
): Promise<HapioPaginatedResponse<HapioRecurringSchedule>> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    `${parentPath}/recurring-schedules`,
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((schedule: any) => ({
      id: schedule.id,
      start_date: schedule.start_date ?? null,
      end_date: schedule.end_date ?? null,
      interval: schedule.interval ?? null,
      location: schedule.location ? {
        id: schedule.location.id,
        name: schedule.location.name ?? null,
        time_zone: schedule.location.time_zone ?? null,
        enabled: schedule.location.enabled ?? true,
      } : null,
      name: schedule.name ?? null,
      metadata: schedule.metadata ?? null,
      created_at: schedule.created_at,
      updated_at: schedule.updated_at,
    })),
  };
}

export async function getRecurringSchedule(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string
): Promise<HapioRecurringSchedule> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const response = await requestJson<any>('get', `${parentPath}/recurring-schedules/${id}`);
  return {
    id: response.id,
    start_date: response.start_date ?? null,
    end_date: response.end_date ?? null,
    interval: response.interval ?? null,
    location: response.location ? {
      id: response.location.id,
      name: response.location.name ?? null,
      time_zone: response.location.time_zone ?? null,
      enabled: response.location.enabled ?? true,
    } : null,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function createRecurringSchedule(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  schedule: HapioRecurringSchedulePayload
): Promise<HapioRecurringSchedule> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const body: Record<string, unknown> = {};
  if (schedule.name !== undefined) body.name = schedule.name;
  if (schedule.location_id !== undefined) body.location_id = schedule.location_id;
  if (schedule.start_date !== undefined) body.start_date = schedule.start_date;
  if (schedule.end_date !== undefined) body.end_date = schedule.end_date;
  if (schedule.metadata !== undefined) body.metadata = schedule.metadata;

  const response = await requestJson<any>('post', `${parentPath}/recurring-schedules`, body);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function updateRecurringSchedule(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  schedule: Partial<HapioRecurringSchedulePayload>
): Promise<HapioRecurringSchedule> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const body: Record<string, unknown> = {};
  if (schedule.name !== undefined) body.name = schedule.name;
  if (schedule.metadata !== undefined) body.metadata = schedule.metadata;

  const response = await requestJson<any>('patch', `${parentPath}/recurring-schedules/${id}`, body);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function replaceRecurringSchedule(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  schedule: HapioRecurringSchedulePayload
): Promise<HapioRecurringSchedule> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  const body: Record<string, unknown> = {};
  if (schedule.name !== undefined) body.name = schedule.name;
  if (schedule.metadata !== undefined) body.metadata = schedule.metadata;

  const response = await requestJson<any>('put', `${parentPath}/recurring-schedules/${id}`, body);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function deleteRecurringSchedule(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string
): Promise<void> {
  const parentPath = buildScheduleParentPath(parentType, parentId);
  await requestJson('delete', `${parentPath}/recurring-schedules/${id}`);
}

// ============================================================================
// Recurring Schedule Blocks Management
// ============================================================================

export interface HapioRecurringScheduleBlock {
  id: string;
  recurring_schedule_id: string;
  weekday?: number | null; // 0 = Sunday, 6 = Saturday (Hapio uses "weekday" not "day_of_week")
  day_of_week?: number | null; // Alias for weekday (for backwards compatibility)
  start_time?: string | null; // HH:mm format
  end_time?: string | null; // HH:mm format
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface HapioRecurringScheduleBlockPayload {
  recurring_schedule_id: string;
  weekday?: number | null; // Hapio API uses "weekday"
  day_of_week?: number | null; // Alias - will be converted to weekday
  start_time?: string | null;
  end_time?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function listRecurringScheduleBlocks(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  params?: {
    recurring_schedule_id?: string;
    page?: number;
    per_page?: number;
  }
): Promise<HapioPaginatedResponse<HapioRecurringScheduleBlock>> {
  if (!parentId) {
    throw new Error('Parent ID is required for listing recurring schedule blocks');
  }
  if (!params?.recurring_schedule_id) {
    throw new Error('recurring_schedule_id is required for listing recurring schedule blocks');
  }

  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  // Based on Postman: /v1/resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks
  const path = `resources/${parentId}/recurring-schedules/${params.recurring_schedule_id}/schedule-blocks`;
  
  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    path,
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((block: any) => ({
      id: block.id,
      recurring_schedule_id: block.recurring_schedule_id,
      weekday: block.weekday ?? block.day_of_week ?? null,
      day_of_week: block.weekday ?? block.day_of_week ?? null, // Alias for compatibility
      start_time: block.start_time ?? null,
      end_time: block.end_time ?? null,
      metadata: block.metadata ?? null,
      created_at: block.created_at,
      updated_at: block.updated_at,
    })),
  };
}

export async function getRecurringScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  recurringScheduleId: string
): Promise<HapioRecurringScheduleBlock> {
  if (!parentId) {
    throw new Error('Parent ID is required for getting recurring schedule blocks');
  }
  // Based on Postman: /v1/resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks/{id}
  const path = `resources/${parentId}/recurring-schedules/${recurringScheduleId}/schedule-blocks/${id}`;
  const response = await requestJson<any>('get', path);
  return {
    id: response.id,
    recurring_schedule_id: response.recurring_schedule_id,
    weekday: response.weekday ?? response.day_of_week ?? null,
    day_of_week: response.weekday ?? response.day_of_week ?? null, // Alias for compatibility
    start_time: response.start_time ?? null,
    end_time: response.end_time ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function createRecurringScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  block: HapioRecurringScheduleBlockPayload
): Promise<HapioRecurringScheduleBlock> {
  // Based on Postman: /v1/resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks
  if (!parentId) {
    throw new Error('Parent ID is required for creating recurring schedule blocks');
  }
  if (!block.recurring_schedule_id) {
    throw new Error('recurring_schedule_id is required for creating recurring schedule blocks');
  }

  const body: Record<string, unknown> = {};
  // Hapio API uses "weekday" not "day_of_week"
  if (block.weekday !== undefined) {
    body.weekday = block.weekday;
  } else if (block.day_of_week !== undefined) {
    // Support both for backwards compatibility
    body.weekday = block.day_of_week;
  }
  if (block.start_time !== undefined) body.start_time = block.start_time;
  if (block.end_time !== undefined) body.end_time = block.end_time;
  if (block.metadata !== undefined) body.metadata = block.metadata;

  // Exact path from Postman: resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks
  const path = `resources/${parentId}/recurring-schedules/${block.recurring_schedule_id}/schedule-blocks`;
  
  const response = await requestJson<any>('post', path, body);
  return {
    id: response.id,
    recurring_schedule_id: response.recurring_schedule_id,
    weekday: response.weekday ?? response.day_of_week ?? null,
    day_of_week: response.weekday ?? response.day_of_week ?? null, // Alias for compatibility
    start_time: response.start_time ?? null,
    end_time: response.end_time ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function updateRecurringScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  block: Partial<HapioRecurringScheduleBlockPayload>,
  recurringScheduleId: string
): Promise<HapioRecurringScheduleBlock> {
  if (!parentId) {
    throw new Error('Parent ID is required for updating recurring schedule blocks');
  }
  const body: Record<string, unknown> = {};
  // Hapio API uses "weekday" not "day_of_week"
  if (block.weekday !== undefined) {
    body.weekday = block.weekday;
  } else if (block.day_of_week !== undefined) {
    body.weekday = block.day_of_week;
  }
  if (block.start_time !== undefined) body.start_time = block.start_time;
  if (block.end_time !== undefined) body.end_time = block.end_time;
  if (block.metadata !== undefined) body.metadata = block.metadata;

  // Based on Postman: /v1/resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks/{id}
  const path = `resources/${parentId}/recurring-schedules/${recurringScheduleId}/schedule-blocks/${id}`;
  const response = await requestJson<any>('patch', path, body);
  return {
    id: response.id,
    recurring_schedule_id: response.recurring_schedule_id,
    weekday: response.weekday ?? response.day_of_week ?? null,
    day_of_week: response.weekday ?? response.day_of_week ?? null, // Alias for compatibility
    start_time: response.start_time ?? null,
    end_time: response.end_time ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function replaceRecurringScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  block: HapioRecurringScheduleBlockPayload,
  recurringScheduleId: string
): Promise<HapioRecurringScheduleBlock> {
  if (!parentId) {
    throw new Error('Parent ID is required for replacing recurring schedule blocks');
  }
  const body: Record<string, unknown> = {};
  // Hapio API uses "weekday" not "day_of_week"
  if (block.weekday !== undefined) {
    body.weekday = block.weekday;
  } else if (block.day_of_week !== undefined) {
    body.weekday = block.day_of_week;
  }
  if (block.start_time !== undefined) body.start_time = block.start_time;
  if (block.end_time !== undefined) body.end_time = block.end_time;
  if (block.metadata !== undefined) body.metadata = block.metadata;

  // Based on Postman: /v1/resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks/{id}
  const path = `resources/${parentId}/recurring-schedules/${recurringScheduleId}/schedule-blocks/${id}`;
  const response = await requestJson<any>('put', path, body);
  return {
    id: response.id,
    recurring_schedule_id: response.recurring_schedule_id,
    weekday: response.weekday ?? response.day_of_week ?? null,
    day_of_week: response.weekday ?? response.day_of_week ?? null, // Alias for compatibility
    start_time: response.start_time ?? null,
    end_time: response.end_time ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function deleteRecurringScheduleBlock(
  parentType: 'project' | 'location' | 'resource',
  parentId: string | undefined,
  id: string,
  recurringScheduleId: string
): Promise<void> {
  if (!parentId) {
    throw new Error('Parent ID is required for deleting recurring schedule blocks');
  }
  // Based on Postman: /v1/resources/{resource_id}/recurring-schedules/{recurring_schedule_id}/schedule-blocks/{id}
  const path = `resources/${parentId}/recurring-schedules/${recurringScheduleId}/schedule-blocks/${id}`;
  await requestJson('delete', path);
}

// ============================================================================
// Bookings Management (extending existing functions)
// ============================================================================

export async function listBookings(params?: {
  from?: string;
  to?: string;
  location_id?: string;
  service_id?: string;
  resource_id?: string;
  status?: string;
  page?: number;
  per_page?: number;
}): Promise<HapioPaginatedResponse<HapioBookingResponse>> {
  const query: Record<string, string | number> = {};
  if (params?.from) query.from = params.from;
  if (params?.to) query.to = params.to;
  if (params?.location_id) query.location_id = params.location_id;
  if (params?.service_id) query.service_id = params.service_id;
  if (params?.resource_id) query.resource_id = params.resource_id;
  if (params?.status) query.status = params.status;
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'bookings',
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((booking: any) => normalizeBooking(booking)),
  };
}

export async function getBooking(id: string): Promise<HapioBookingResponse> {
  return normalizeBooking(await requestJson<any>('get', `bookings/${id}`));
}

export async function createBooking(booking: HapioBookingPayload): Promise<HapioBookingResponse> {
  return createPendingBooking(booking);
}

export async function updateBooking(
  id: string,
  booking: HapioBookingUpdatePayload
): Promise<HapioBookingResponse> {
  const body: Record<string, unknown> = {};
  if (booking.startsAt) body.starts_at = booking.startsAt;
  if (booking.endsAt) body.ends_at = booking.endsAt;
  if (booking.resourceId !== undefined) body.resource_id = booking.resourceId;
  if (booking.metadata) body.metadata = booking.metadata;
  if (booking.protectedMetadata) body.protected_metadata = booking.protectedMetadata;
  if (typeof booking.isTemporary === 'boolean') body.is_temporary = booking.isTemporary;
  if (typeof booking.ignoreSchedule === 'boolean') body.ignore_schedule = booking.ignoreSchedule;
  if (typeof booking.ignoreFullyBooked === 'boolean')
    body.ignore_fully_booked = booking.ignoreFullyBooked;
  if (typeof booking.ignoreBookableSlots === 'boolean')
    body.ignore_bookable_slots = booking.ignoreBookableSlots;

  return normalizeBooking(await requestJson<any>('patch', `bookings/${id}`, body));
}

export async function replaceBooking(
  id: string,
  booking: HapioBookingPayload
): Promise<HapioBookingResponse> {
  const body: Record<string, unknown> = {
    location_id: booking.locationId,
    service_id: booking.serviceId,
    starts_at: booking.startsAt,
    ends_at: booking.endsAt,
  };
  if (booking.resourceId) body.resource_id = booking.resourceId;
  if (booking.metadata) body.metadata = booking.metadata;
  if (booking.protectedMetadata) body.protected_metadata = booking.protectedMetadata;
  if (typeof booking.isTemporary === 'boolean') body.is_temporary = booking.isTemporary;
  if (typeof booking.ignoreSchedule === 'boolean') body.ignore_schedule = booking.ignoreSchedule;
  if (typeof booking.ignoreFullyBooked === 'boolean')
    body.ignore_fully_booked = booking.ignoreFullyBooked;
  if (typeof booking.ignoreBookableSlots === 'boolean')
    body.ignore_bookable_slots = booking.ignoreBookableSlots;

  return normalizeBooking(await requestJson<any>('put', `bookings/${id}`, body));
}

// ============================================================================
// Booking Groups Management
// ============================================================================

export interface HapioBookingGroup {
  id: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface HapioBookingGroupPayload {
  name?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function listBookingGroups(params?: {
  page?: number;
  per_page?: number;
}): Promise<HapioPaginatedResponse<HapioBookingGroup>> {
  const query: Record<string, string | number> = {};
  if (params?.page) query.page = params.page;
  if (params?.per_page) query.per_page = params.per_page;

  const response = await requestJson<HapioPaginatedResponse<any>>(
    'get',
    'booking-groups',
    { params: query }
  );

  return {
    ...response,
    data: response.data.map((group: any) => ({
      id: group.id,
      name: group.name ?? null,
      metadata: group.metadata ?? null,
      created_at: group.created_at,
      updated_at: group.updated_at,
    })),
  };
}

export async function getBookingGroup(id: string): Promise<HapioBookingGroup> {
  const response = await requestJson<any>('get', `booking-groups/${id}`);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function createBookingGroup(
  group: HapioBookingGroupPayload
): Promise<HapioBookingGroup> {
  const body: Record<string, unknown> = {};
  if (group.name !== undefined) body.name = group.name;
  if (group.metadata !== undefined) body.metadata = group.metadata;

  const response = await requestJson<any>('post', 'booking-groups', body);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function updateBookingGroup(
  id: string,
  group: Partial<HapioBookingGroupPayload>
): Promise<HapioBookingGroup> {
  const body: Record<string, unknown> = {};
  if (group.name !== undefined) body.name = group.name;
  if (group.metadata !== undefined) body.metadata = group.metadata;

  const response = await requestJson<any>('patch', `booking-groups/${id}`, body);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function replaceBookingGroup(
  id: string,
  group: HapioBookingGroupPayload
): Promise<HapioBookingGroup> {
  const body: Record<string, unknown> = {};
  if (group.name !== undefined) body.name = group.name;
  if (group.metadata !== undefined) body.metadata = group.metadata;

  const response = await requestJson<any>('put', `booking-groups/${id}`, body);
  return {
    id: response.id,
    name: response.name ?? null,
    metadata: response.metadata ?? null,
    created_at: response.created_at,
    updated_at: response.updated_at,
  };
}

export async function deleteBookingGroup(id: string): Promise<void> {
  await requestJson('delete', `booking-groups/${id}`);
}


