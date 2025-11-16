import { NextRequest, NextResponse } from 'next/server';
import { calRequest } from '@/lib/calClient';

interface Params {
  reservationId: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  const { reservationId } = params;

  if (!reservationId) {
    return NextResponse.json(
      { error: 'Reservation ID is required' },
      { status: 400 }
    );
  }

  try {
    const response = await calRequest<any>('get', `slots/reservations/${reservationId}`);
    return NextResponse.json({
      status: 'success',
      reservation: response.data ?? response,
    });
  } catch (error: any) {
    const responseData = error.response?.data || {};
    const message =
      responseData?.details?.message ||
      responseData?.message ||
      responseData?.error ||
      error.message ||
      'Failed to verify reservation';
    console.error('Failed to verify Cal.com reservation:', responseData || error.message);
    const status = error.response?.status || 500;
    return NextResponse.json(
      {
        status: 'error',
        message,
        details: responseData,
      },
      { status }
    );
  }
}
