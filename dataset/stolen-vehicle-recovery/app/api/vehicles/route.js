import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const reported = await prisma.reportedVehicle.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const detected = await prisma.detectedVehicle.findMany({
      orderBy: { timestamp: 'desc' }
    });

    return NextResponse.json({ success: true, reported, detected });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    await prisma.reportedVehicle.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
