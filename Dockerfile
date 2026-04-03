FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy backend and public folder
COPY backend ./backend

# Create uploads directory
RUN mkdir -p backend/uploads

# Expose port
EXPOSE 10000

# Start the app
CMD ["node", "backend/index.js"]
