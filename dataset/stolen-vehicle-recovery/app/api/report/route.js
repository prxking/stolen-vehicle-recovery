import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const data = await req.json();

    const vehicle = await prisma.reportedVehicle.create({
      data: {
        plateNumber: data.plateNumber,
        location: data.location,
        make: data.make,
        model: data.model,
        variant: data.variant,
        color: data.color,
        aadharNumber: data.aadharNumber,
        phone: data.phone,
      }
    });

    return NextResponse.json({ success: true, vehicle });
  } catch (error) {
    console.error('Error reporting vehicle:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
