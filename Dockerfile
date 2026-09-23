# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
RUN yarn build

# Stage 2: Build Backend
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app

# Copy go.mod and go.sum
COPY go.mod go.sum ./
RUN go mod download

# Copy backend source
COPY backend/ ./backend/

# Copy frontend dist to backend/http/dist
COPY --from=frontend-builder /app/frontend/dist ./backend/http/dist

# Build
WORKDIR /app/backend
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-s -w" -o whitelist-download main.go

# Stage 3: Runner
FROM alpine:latest
WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata

COPY --from=backend-builder /app/backend/whitelist-download ./

# Provide directories for config and data to be mounted via volume
ENV XDG_CONFIG_HOME=/app/data/config
ENV XDG_DATA_HOME=/app/data/share
ENV XDG_STATE_HOME=/app/data/state

EXPOSE 55000

CMD ["./whitelist-download"]
