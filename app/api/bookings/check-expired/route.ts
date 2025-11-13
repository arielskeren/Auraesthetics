import { NextResponse } from 'next/server';

const message =
  'Token-based Cal.com holds have been retired. Hapio manages slot holds directly and no longer requires manual token expiration jobs.';

export async function GET() {
  return NextResponse.json({ error: message }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: message }, { status: 410 });
}

