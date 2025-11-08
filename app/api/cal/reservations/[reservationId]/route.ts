import { NextRequest, NextResponse } from 'next/server';
import { calRequest } from '@/lib/calClient';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { reservationId: string } }
) {
  const reservationId = params?.reservationId;

  if (!reservationId) {
    return NextResponse.json(
      { error: 'Reservation ID is required' },
      { status: 400 }
    );
  }

  try {
    await calRequest('delete', `reservations/${reservationId}`);

    return NextResponse.json({
      success: true,
      reservationId,
    });
  } catch (error: any) {
    console.error('Failed to release reservation:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    return NextResponse.json(
      {
        error: 'Failed to release reservation',
        details: error.response?.data || error.message,
      },
      { status }
    );
  }
}


