#!/bin/bash
# Bloom Daemon - monitors activity and handles shutdown triggers

IDLE_TIMEOUT=${IDLE_TIMEOUT:-7200}  # 2 hours default
WEBHOOK_URL="${WEBHOOK_URL}"
WEBHOOK_SECRET="${WEBHOOK_SECRET}"

last_activity=$(date +%s)

check_terminal_activity() {
  # Check if there's been recent terminal input
  if [ -f /tmp/bloom-last-activity ]; then
    last_activity=$(cat /tmp/bloom-last-activity)
  fi
}

send_heartbeat() {
  local idle_seconds=$(($(date +%s) - last_activity))
  curl -s -X POST "${WEBHOOK_URL}/webhook/heartbeat" \
    -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{
      \"state\": \"running\",
      \"idleSeconds\": ${idle_seconds},
      \"timestamp\": \"$(date -Iseconds)\"
    }"
}

trigger_shutdown() {
  local reason=$1
  echo "$(date): Triggering shutdown - reason: ${reason}"

  # Notify worker
  curl -s -X POST "${WEBHOOK_URL}/webhook/${reason}" \
    -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": \"$(date -Iseconds)\"}"
}

# Main loop
while true; do
  check_terminal_activity
  idle_seconds=$(($(date +%s) - last_activity))

  # Send heartbeat every 30 seconds
  send_heartbeat

  # Check idle timeout
  if [ "$idle_seconds" -ge "$IDLE_TIMEOUT" ]; then
    trigger_shutdown "idle-timeout"
    exit 0
  fi

  sleep 30
done
