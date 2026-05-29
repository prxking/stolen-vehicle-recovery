import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const data = await req.json();
    
    // 1. Record the detection from YOLO
    const detected = await prisma.detectedVehicle.create({
      data: {
        plateNumber: data.plateNumber,
        location: data.location,
        make: data.make,
        model: data.model,
        color: data.color,
        confidence: data.confidence,
        imageUrl: data.imageUrl,
      }
    });

    // 2. Auto-Recovery Matching Engine
    // Check if this plate number is currently reported as MISSING
    const missingVehicle = await prisma.reportedVehicle.findFirst({
      where: {
        plateNumber: data.plateNumber,
        status: 'MISSING'
      }
    });

    if (missingVehicle) {
      // We found a match! Update status to SPOTTED
      await prisma.reportedVehicle.update({
        where: { id: missingVehicle.id },
        data: { status: 'SPOTTED' }
      });
      console.log(`[MATCH] Vehicle ${data.plateNumber} has been flagged as SPOTTED!`);
    }

    return NextResponse.json({ success: true, detected, matchFound: !!missingVehicle });
  } catch (error) {
    console.error('Error recording detection:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
