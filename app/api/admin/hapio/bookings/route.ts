import { NextRequest, NextResponse } from 'next/server';
import { listBookings, createBooking } from '@/lib/hapioClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const locationId = searchParams.get('location_id') ?? undefined;
    const serviceId = searchParams.get('service_id') ?? undefined;
    const resourceId = searchParams.get('resource_id') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
    const perPage = searchParams.get('per_page') ? Number(searchParams.get('per_page')) : undefined;

    const response = await listBookings({
      from,
      to,
      location_id: locationId,
      service_id: serviceId,
      resource_id: resourceId,
      status,
      page,
      per_page: perPage,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[Hapio] Failed to list bookings', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to retrieve bookings';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const booking = await createBooking(body);
    return NextResponse.json({ booking });
  } catch (error: any) {
    console.error('[Hapio] Failed to create booking', error);
    const message = typeof error?.message === 'string' ? error.message : 'Failed to create booking';
    const status = Number(error?.status) || 500;
    return NextResponse.json(
      {
        error: message,
        details: error?.response?.data || null,
      },
      { status }
    );
  }
}

