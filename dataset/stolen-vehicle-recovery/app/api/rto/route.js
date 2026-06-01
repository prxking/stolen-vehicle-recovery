import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rtoRecords = await prisma.rTODatabase.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, data: rtoRecords });
  } catch (error) {
    console.error('Error fetching RTO data:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
