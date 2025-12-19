#!/bin/bash
# Wrapper script for running Kilo Code in autonomous mode

TASK="$1"
WEBHOOK_URL="${WEBHOOK_URL}"
WEBHOOK_SECRET="${WEBHOOK_SECRET}"

# Run Kilo in autonomous mode
kilocode --auto "$TASK" --timeout 3600

EXIT_CODE=$?

# Report completion
if [ $EXIT_CODE -eq 0 ]; then
  STATUS="completed"
elif [ $EXIT_CODE -eq 124 ]; then
  STATUS="timeout"
else
  STATUS="failed"
fi

curl -X POST "${WEBHOOK_URL}/webhook/task-complete" \
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"${STATUS}\",
    \"exitCode\": ${EXIT_CODE},
    \"timestamp\": \"$(date -Iseconds)\"
  }"

# If auto-shutdown enabled and task complete, trigger shutdown
if [ "$AUTO_SHUTDOWN" = "true" ] && [ "$STATUS" = "completed" ]; then
  /opt/bloom/sync-to-r2.sh
  curl -X POST "${WEBHOOK_URL}/webhook/task-complete" \
    -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
    -H "Content-Type: application/json" \
    -d '{"triggerShutdown": true}'
fi
