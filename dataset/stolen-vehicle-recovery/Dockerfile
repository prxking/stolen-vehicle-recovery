FROM node:18-alpine

WORKDIR /app

# Install dependencies needed for SQLite & Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json ./

# Install npm dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
