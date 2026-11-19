# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy source and build the application
COPY . .
# Setting VITE_API_URL via ARG to allow dynamic configuration at build time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Serve Stage
FROM nginx:alpine

# Copy the build output to Nginx's html folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
