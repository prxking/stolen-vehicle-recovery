const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const makesModels = {
  "Maruti Suzuki": ["Alto K10", "Swift", "Baleno", "Dzire", "Brezza"],
  "Hyundai": ["i20", "Creta", "Venue", "Verna"],
  "Tata": ["Nexon", "Punch", "Harrier", "Tiago"],
  "Mahindra": ["XUV700", "Thar", "Scorpio-N"],
  "Kia": ["Seltos", "Sonet", "Carens"],
  "Toyota": ["Innova Crysta", "Fortuner", "Glanza"]
};

const colors = ["White", "Silver", "Grey", "Black", "Red", "Blue"];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDateInPast10Years() {
  const now = new Date();
  const past = new Date();
  past.setFullYear(now.getFullYear() - 10);
  const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime);
}

function randomPlate() {
  const letters1 = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num1 = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  const letters2 = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num2 = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `KL${num1}${letters2}${num2}`;
}

function randomPhone() {
  const prefix = ["98", "99", "94", "88", "77", "95"][Math.floor(Math.random() * 6)];
  const suffix = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${suffix}`;
}

function randomAadhar() {
  return "000000000000"; // Invalid Aadhar for security
}

const fakeNames = [
  "Rahul Sharma", "Priya Singh", "Amit Kumar", "Anjali Nair",
  "Ramesh Patel", "Sneha Gupta", "Vikram Reddy", "Kavita Desai",
  "Suresh Iyer", "Neha Menon", "Rajesh Verma", "Pooja Joshi",
  "Arun Kumar", "Divya Pillai", "Manoj Tiwari", "Kiran Rao"
];

function randomName() {
  return randomChoice(fakeNames);
}

async function seed() {
  let extractedPlates = [];
  try {
    const data = fs.readFileSync(path.join(__dirname, 'extracted_plates.json'), 'utf8');
    extractedPlates = JSON.parse(data);
  } catch (e) {
    console.log("No extracted_plates.json found or failed to parse. Proceeding without video plates.");
  }

  const entries = [];
  const seenPlates = new Set();

  // Mismatched Plate
  const MISMATCH_PLATE = "KL1623942";
  entries.push({
    plateNumber: MISMATCH_PLATE,
    make: "Tata", // Mismatched (Real is likely different)
    model: "Nano",
    variant: "Std",
    color: "Pink",
    ownerName: "Abhishek Nair",
    aadharNumber: randomAadhar(),
    phone: randomPhone(),
    createdAt: randomDateInPast10Years()
  });
  seenPlates.add(MISMATCH_PLATE);

  // Include KLO1CM5472 as a valid plate
  entries.push({
    plateNumber: "KLO1CM5472",
    make: "Ford",
    model: "EcoSport", // Random model for Ford
    variant: "Base",
    color: "brown",
    ownerName: randomName(),
    aadharNumber: randomAadhar(),
    phone: randomPhone(),
    createdAt: randomDateInPast10Years()
  });
  seenPlates.add("KLO1CM5472");


  // Include specific video plates that were detected, so they show as VALID
  entries.push({
    plateNumber: "KL81A7997",
    make: "hyundai",
    model: "creta",
    variant: "Base",
    color: "grey",
    ownerName: randomName(),
    aadharNumber: randomAadhar(),
    phone: randomPhone(),
    createdAt: randomDateInPast10Years()
  });
  seenPlates.add("KL81A7997");

  entries.push({
    plateNumber: "OL12C09923",
    make: "Tata",
    model: "Nexon",
    variant: "Base",
    color: "silver",
    ownerName: randomName(),
    aadharNumber: randomAadhar(),
    phone: randomPhone(),
    createdAt: randomDateInPast10Years()
  });
  seenPlates.add("OL12C09923");

  // Include any other plates if extracted_plates.json was loaded
  for (const v of extractedPlates) {
    if (!seenPlates.has(v.plateNumber)) {
      entries.push({
        plateNumber: v.plateNumber,
        make: v.make || "Unknown",
        model: v.model || "Unknown",
        variant: "Base",
        color: v.color || "White",
        ownerName: randomName(),
        aadharNumber: randomAadhar(),
        phone: randomPhone(),
        createdAt: randomDateInPast10Years()
      });
      seenPlates.add(v.plateNumber);
    }
  }

  // Generate around 100 random entries
  while (entries.length < 100 + extractedPlates.length) {
    const p = randomPlate();
    if (!seenPlates.has(p)) {
      const make = randomChoice(Object.keys(makesModels));
      const model = randomChoice(makesModels[make]);
      entries.push({
        plateNumber: p,
        make: make,
        model: model,
        variant: "Base",
        color: randomChoice(colors),
        ownerName: randomName(),
        aadharNumber: randomAadhar(),
        phone: randomPhone(),
        createdAt: randomDateInPast10Years()
      });
      seenPlates.add(p);
    }
  }

  // Clear existing to avoid unique constraint errors during test
  await prisma.rTODatabase.deleteMany({});
  
  // Clear existing detections so the live tab is empty before the script runs
  await prisma.detectedVehicle.deleteMany({});
  
  // Insert
  await prisma.rTODatabase.createMany({
    data: entries
  });

  console.log(`Successfully seeded ${entries.length} records into RTODatabase.`);
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
