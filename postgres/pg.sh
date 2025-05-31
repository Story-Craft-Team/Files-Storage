#!/bin/bash

source .env

CONTAINER_NAME="files_storage_db"
COMPOSE_FILE="docker-compose.yml"

if ! command -v docker-compose &> /dev/null; then
  echo "Error: docker-compose not found"
  exit 1
fi

case "$1" in
  start)
    echo "Starting PostgreSQL container..."
    docker-compose -f "$COMPOSE_FILE" up -d
    ;;
  stop)
    echo "Stopping PostgreSQL container..."
    docker-compose -f "$COMPOSE_FILE" down
    ;;
  restart)
    echo "Restarting PostgreSQL container..."
    docker-compose -f "$COMPOSE_FILE" restart
    ;;
  build)
    echo "Building PostgreSQL container..."
    docker-compose -f "$COMPOSE_FILE" build
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|build}"
    exit 1
esac

if [[ "$1" == "start" || "$1" == "restart" ]]; then
  echo "Checking container status..."
  sleep 2
  docker ps -f name=$CONTAINER_NAME --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

exit 0