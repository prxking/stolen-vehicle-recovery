import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const data = await req.json();
    
    // RTO Validation
    let rtoStatus = 'VALID';
    let rtoDetails = null;

    const rtoRecord = await prisma.rTODatabase.findUnique({
      where: { plateNumber: data.plateNumber }
    });

    if (!rtoRecord) {
      rtoStatus = 'UNREGISTERED';
      rtoDetails = 'Plate not found in RTO Database';
    } else {
      // Basic check for mismatch (e.g. check make and color)
      const dataMake = data.make ? data.make.toLowerCase() : '';
      const dataModel = data.model ? data.model.toLowerCase() : '';
      const fullDataStr = `${dataMake} ${dataModel}`.trim();

      const rtoMake = rtoRecord.make ? rtoRecord.make.toLowerCase() : '';
      const rtoModel = rtoRecord.model ? rtoRecord.model.toLowerCase() : '';
      const fullRtoStr = `${rtoMake} ${rtoModel}`;
      
      const dataColor = data.color ? data.color.toLowerCase() : '';
      const rtoColor = rtoRecord.color ? rtoRecord.color.toLowerCase() : '';
      
      let mismatchReasons = [];

      let isMakeMismatch = false;
      if (fullDataStr) {
         const dataTokens = [...new Set(fullDataStr.split(/\s+/).filter(Boolean))];
         // If any token from the detection (e.g. 'creta') is not found in the RTO string (e.g. 'hyundai i20'), it's a contradiction
         for (const token of dataTokens) {
            if (!fullRtoStr.includes(token)) {
               isMakeMismatch = true;
               break;
            }
         }
         // Or if there is zero overlap at all
         const hasCommon = dataTokens.some(t => fullRtoStr.includes(t));
         if (!hasCommon && dataTokens.length > 0) isMakeMismatch = true;
      }

      if (isMakeMismatch) {
         mismatchReasons.push(`Make/Model: ${rtoRecord.make} ${rtoRecord.model}`);
      }
      
      if (dataColor && rtoColor && dataColor !== rtoColor) {
         mismatchReasons.push(`Color: ${rtoRecord.color}`);
      }

      if (mismatchReasons.length > 0) {
         rtoStatus = 'MISMATCH';
         rtoDetails = `RTO mismatch - ${mismatchReasons.join(', ')}`;
      }
    }

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
        rtoStatus: rtoStatus,
        rtoDetails: rtoDetails
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

    return NextResponse.json({ success: true, detected, matchFound: !!missingVehicle, rtoStatus, rtoDetails });
  } catch (error) {
    console.error('Error recording detection:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
