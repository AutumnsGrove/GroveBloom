#!/bin/bash
# Wrapper script for running Kilo Code in autonomous mode

TASK="$1"
TASK_ID="${TASK_ID:-}"
WEBHOOK_URL="${WEBHOOK_URL}"
WEBHOOK_SECRET="${WEBHOOK_SECRET}"
AUTO_SHUTDOWN="${AUTO_SHUTDOWN:-false}"

# Run Kilo in autonomous mode
kilocode --auto "$TASK" --timeout 3600

EXIT_CODE=$?

# Determine status from exit code
if [ $EXIT_CODE -eq 0 ]; then
  STATUS="completed"
elif [ $EXIT_CODE -eq 124 ]; then
  STATUS="timeout"
else
  STATUS="failed"
fi

# Determine if we should trigger shutdown
TRIGGER_SHUTDOWN="false"
if [ "$AUTO_SHUTDOWN" = "true" ] && [ "$STATUS" = "completed" ]; then
  # Sync to R2 before shutdown
  /opt/bloom/sync-to-r2.sh
  TRIGGER_SHUTDOWN="true"
fi

# Send single consolidated webhook with all data
curl -X POST "${WEBHOOK_URL}/webhook/task-complete" \
  -H "Authorization: Bearer ${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{
    \"status\": \"${STATUS}\",
    \"exitCode\": ${EXIT_CODE},
    \"taskId\": \"${TASK_ID}\",
    \"triggerShutdown\": ${TRIGGER_SHUTDOWN},
    \"timestamp\": \"$(date -Iseconds)\"
  }"
