#!/usr/bin/env bash

# Run the test suite, capture everything it prints, and flag anything worth 
# cleaning up: failing tests or stray console output.
#
# When something is found, Claude reads the captured report and writes a list of
# recommended fixes. It only ever writes the recommendations file: the report is
# handed to it on stdin and its answer is redirected, so it never touches the
# repo itself.
#
# NOTE: the recommendations step needs the claude command line tool installed.

set -euo pipefail;

# =========================================================================== #
#                                    Constants                                #
# =========================================================================== #

REPORT_FILE="scripts/test-assistant/report.tmp.txt";
RECOMMENDATIONS_FILE="scripts/test-assistant/recommended-fixes.tmp.md";

# The claude runner owns the model and the prompt: it reads its content from
# tmp/input.txt and writes the answer to tmp/output.txt, both alongside its own
# script. Paths are relative to the repo root, so this must be run from there.
CLAUDE_RUNNER_DIR="./scripts/claude-runner";
CLAUDE_RUNNER="${CLAUDE_RUNNER_DIR}/main.sh";
CLAUDE_INPUT="${CLAUDE_RUNNER_DIR}/tmp/input.txt";
CLAUDE_OUTPUT="${CLAUDE_RUNNER_DIR}/tmp/output.txt";

CLAUDE_PROMPT_NAME="get-recommended-test-fixes";

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

# -- Run the tests and capture everything printed to the console -- #
# The default reporter hides console output from passing tests, so use the
# verbose one, otherwise stray console calls could never be detected. A failing
# suite is an expected outcome here, hence the `|| true`.
#
# NO_COLOR keeps vitest from writing escape sequences into the report: they are
# unreadable in an editor, and they sit at the start of a line ("\033[2m Tests
# ...") where they break any pattern anchored with ^. The sed pass strips any
# that still slip through, since not every tool honours NO_COLOR.
echo "==> Running tests";
NO_COLOR=1 npm run test -- --reporter=verbose 2>&1 \
  | sed $'s/\033\\[[0-9;]*[a-zA-Z]//g' > "$REPORT_FILE" || true;

# -- Report the pass/fail counts, whatever the outcome was -- #
# vitest prints a summary line like "Tests  1 failed | 53 passed (54)". A count
# is left out entirely when it is zero, so each one defaults to 0 here.
TESTS_LINE="$(grep -E '^[[:space:]]*Tests[[:space:]]' "$REPORT_FILE" | tail -1 || true)";
run_crashed=false;
if [ -z "$TESTS_LINE" ]; then
  # No summary means vitest never got as far as running the suite (a syntax
  # error, no test files found, a bad config...). That is never "clean", and
  # the report is the only record of why, so show it and keep it.
  run_crashed=true;
  echo "Warning: could not find a test summary, the run may have crashed." >&2;
  echo "-- last lines of the report --" >&2;
  tail -n 15 "$REPORT_FILE" >&2;
  echo "-- end of report --" >&2;
else
  PASSED="$(printf '%s' "$TESTS_LINE" | grep -oE '[0-9]+ passed' | grep -oE '^[0-9]+' || true)";
  FAILED="$(printf '%s' "$TESTS_LINE" | grep -oE '[0-9]+ failed' | grep -oE '^[0-9]+' || true)";
  echo "==> Tests results, passed: ${PASSED:-0}, failed: ${FAILED:-0}";
fi

# -- Iterate the report and decide whether anything needs attention -- #
# A crashed run counts as an issue on its own: without a summary the loop below
# has nothing to match on, so it would otherwise be mistaken for a clean run.
all_clean=true;
if [ "$run_crashed" = true ]; then
  all_clean=false;
fi
while IFS= read -r line; do
  case "$line" in
    # console.log/console.info during a test
    "stdout | "*) all_clean=false ;;
    # console.warn/console.error during a test
    "stderr | "*) all_clean=false ;;
    # an individual failing test
    *" FAIL "*) all_clean=false ;;
    # the summary counts, e.g. "Tests  1 failed | 53 passed"
    *"Tests"*"failed"*) all_clean=false ;;
    *"Test Files"*"failed"*) all_clean=false ;;
  esac
done < "$REPORT_FILE";

# -- Nothing to report: drop both temp files and stop here -- #
# The recommendations file may be left over from an earlier failing run, so
# clear it too, otherwise stale advice hangs around looking current.
if [ "$all_clean" = true ]; then
  rm -f "$REPORT_FILE" "$RECOMMENDATIONS_FILE";
  echo "Nothing to report, everything is clean.";
  exit 0;
fi

# -- Something to report: have Claude recommend fixes -- #
echo "==> Issues found, generating recommended fixes";

# Hand the report to the runner through its input file. The old output is
# removed first so a stale answer from an earlier run can never be mistaken for
# a fresh one if the runner fails.
cp "$REPORT_FILE" "$CLAUDE_INPUT";
rm -f "$CLAUDE_OUTPUT";

bash "$CLAUDE_RUNNER" "$CLAUDE_PROMPT_NAME" || true;

# Keep only what came back inside the ```md fence: anything Claude says around
# it (preamble, sign-off) is dropped. The block is taken from the opening ```md
# to the *last* fence in the answer, so code samples fenced inside the report
# survive intact. If no ```md block came back at all, the whole answer is kept
# rather than silently writing an empty file.
if [ -s "$CLAUDE_OUTPUT" ]; then
  awk '
    { lines[NR] = $0 }
    /^[[:space:]]*```[[:space:]]*(md|markdown)[[:space:]]*$/ { if (!start) start = NR }
    /^[[:space:]]*```/ { last = NR }
    END {
      if (start && last > start) {
        for (i = start + 1; i < last; i++) print lines[i];
      } else {
        for (i = 1; i <= NR; i++) print lines[i];
      }
    }
  ' "$CLAUDE_OUTPUT" > "$RECOMMENDATIONS_FILE" || true;
fi

if [ ! -s "$RECOMMENDATIONS_FILE" ]; then
  echo "Warning: no recommendations were returned." >&2;
  rm -f "$RECOMMENDATIONS_FILE";
  echo "Report left at: ${REPORT_FILE}" >&2;
  exit 1;
fi

echo "==> Done.";
echo "  Report:          ${REPORT_FILE}";
echo "  Recommendations: ${RECOMMENDATIONS_FILE}";
