#!/usr/bin/env bash

# `main.sh` — run one of the saved prompts through the claude CLI.
#
# The prompt is picked by name from the prompts/ folder, given without the .txt
# suffix: `./main.sh commit-message` uses prompts/commit-message.txt. The input
# file is piped in as the content to work on, and the answer is written to the
# output file.
#
# Usage: ./main.sh <prompt-name>

set -euo pipefail;

# =========================================================================== #
#                                    Constants                                #
# =========================================================================== #

# Everything lives next to this script, so it works whatever the cwd is.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)";
PROMPTS_DIR="${SCRIPT_DIR}/prompts";
TEMP_DIR="${SCRIPT_DIR}/tmp";

CLAUDE_MODEL="claude-opus-4-6";
INPUT_FILE="${TEMP_DIR}/input.txt";
OUTPUT_FILE="${TEMP_DIR}/output.txt";

# =========================================================================== #
#                                    Functions                                #
# =========================================================================== #

# List the prompt names that can be passed in, i.e. without the .txt suffix.
print_available_prompts() {
  echo "Available prompts:" >&2;
  for file in "$PROMPTS_DIR"/*.txt; do
    [ -f "$file" ] || continue;
    name="$(basename "$file" .txt)";
    echo "  ${name}" >&2;
  done
}

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

# -- Resolve the prompt named by the first argument -- #
if [ "$#" -lt 1 ] || [ -z "${1:-}" ]; then
  echo "Usage: $0 <prompt-name>" >&2;
  print_available_prompts;
  exit 1;
fi

# The name is passed in without the extension, so add it back on here.
PROMPT_NAME="$1";
PROMPT_FILE="${PROMPTS_DIR}/${PROMPT_NAME}.txt";

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: no prompt named '${PROMPT_NAME}' in ${PROMPTS_DIR}" >&2;
  print_available_prompts;
  exit 1;
fi

PROMPT="$(cat "$PROMPT_FILE")";

# -- Make sure the claude command line tool is installed -- #
if ! command -v claude >/dev/null 2>&1; then
  echo "Error: 'claude' not found on PATH, exiting." >&2;
  exit 1;
fi

# -- Make sure there is something to work on -- #
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: input file not found: ${INPUT_FILE}" >&2;
  exit 1;
fi

STATUS_MESSAGE="Running prompt '${PROMPT_NAME}' with model '${CLAUDE_MODEL}'";

# Claude takes a while, so run it in the background and tick a seconds counter
# next to the message while it works. SECONDS is a bash builtin that counts up
# on its own, so the count stays accurate even if a sleep runs long.
SECONDS=0;

claude -p "$PROMPT" --model "$CLAUDE_MODEL" \
  < "$INPUT_FILE" > "$OUTPUT_FILE" 2>/dev/null &
CLAUDE_PID=$!;

if [ -t 1 ]; then
  # Interactive: redraw the same line so the count ticks over in place.
  while kill -0 "$CLAUDE_PID" 2>/dev/null; do
    printf '\r%s (%ds)' "$STATUS_MESSAGE" "$SECONDS";
    sleep 1;
  done
  wait "$CLAUDE_PID" || true;
  printf '\r%s (%ds)\n' "$STATUS_MESSAGE" "$SECONDS";
else
  # Piped or redirected: no cursor to move, so just report the total at the end.
  echo "$STATUS_MESSAGE";
  wait "$CLAUDE_PID" || true;
  echo "${STATUS_MESSAGE} (${SECONDS}s)";
fi

echo "Output written to: ${OUTPUT_FILE}";
