# syntax=docker/dockerfile:1.7

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/portfolio-api ./cmd/api

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=builder /out/portfolio-api /usr/local/bin/portfolio-api
EXPOSE 8080
ENTRYPOINT ["portfolio-api"]
