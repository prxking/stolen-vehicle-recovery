import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function PUT(req) {
  try {
    const data = await req.json();
    const { id, status } = data;
    
    const updated = await prisma.reportedVehicle.update({
      where: { id },
      data: { status }
    });

    return NextResponse.json({ success: true, updated });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
