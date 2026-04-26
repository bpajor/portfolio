# syntax=docker/dockerfile:1.7

FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY apps/mcp/go.mod apps/mcp/go.sum ./
RUN go mod download
COPY apps/mcp ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/portfolio-mcp ./cmd/mcp

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=builder /out/portfolio-mcp /usr/local/bin/portfolio-mcp
EXPOSE 8090
ENTRYPOINT ["portfolio-mcp"]
