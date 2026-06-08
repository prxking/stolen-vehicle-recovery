const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fetchWikimediaImage(make, model, color) {
  try {
    // Search query prioritizing Make + Model
    // We add color if possible, but Wikipedia is unlikely to have color-specific car names as titles
    const query = encodeURIComponent(`${make} ${model}`);
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&generator=search&gsrsearch=${query}&pithumbsize=500`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.query && data.query.pages) {
      // Find the first valid page with an image
      const pages = Object.values(data.query.pages);
      // Sort by index to get the most relevant result
      pages.sort((a, b) => a.index - b.index);
      
      for (const page of pages) {
        if (page.thumbnail && page.thumbnail.source) {
          return page.thumbnail.source;
        }
      }
    }
  } catch (error) {
    console.error(`Failed to fetch image for ${make} ${model}:`, error.message);
  }
  return null;
}

async function main() {
  console.log('Starting RTO Database Image Seeding...');
  
  const records = await prisma.rTODatabase.findMany();
  console.log(`Found ${records.length} records. Processing...`);

  let updated = 0;
  for (const record of records) {
    if (!record.imageUrl) {
      console.log(`Fetching image for: ${record.make} ${record.model} (${record.color})`);
      const imageUrl = await fetchWikimediaImage(record.make, record.model, record.color);
      
      if (imageUrl) {
        await prisma.rTODatabase.update({
          where: { id: record.id },
          data: { imageUrl }
        });
        console.log(`  -> Success: ${imageUrl}`);
        updated++;
      } else {
        console.log(`  -> No image found.`);
      }
      
      // Sleep slightly to respect Wikipedia API limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log(`Finished! Updated ${updated} records.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
