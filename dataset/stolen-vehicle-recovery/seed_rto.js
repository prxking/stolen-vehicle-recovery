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

  // Insert the requested plates explicitly
  const customPlates = [
    { plateNumber: "KL818731", make: "Tata", model: "Tiago", color: "grey" },
    { plateNumber: "KL01CM5472", make: "Ford", model: "Ecosport", color: "brown" },
    { plateNumber: "KL16Z3942", make: "Maruti", model: "WagonR", color: "silver" },
    { plateNumber: "KL81A7997", make: "Hyundai", model: "Creta", color: "grey" },
    { plateNumber: "DL12CQ9923", make: "Honda", model: "City", color: "red" } // Mismatched intentionally
  ];

  for (const cp of customPlates) {
    if (!seenPlates.has(cp.plateNumber)) {
      entries.push({
        plateNumber: cp.plateNumber,
        make: cp.make,
        model: cp.model,
        variant: "Base",
        color: cp.color,
        ownerName: randomName(),
        aadharNumber: randomAadhar(),
        phone: randomPhone(),
        createdAt: randomDateInPast10Years()
      });
      seenPlates.add(cp.plateNumber);
    }
  }

  // Generate random entries until we hit the total limit of 110
  while (entries.length < 110) {
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
