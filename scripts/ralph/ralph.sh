#!/bin/bash
set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Ralph - Autonomous AI Coding Loop"
echo "   Max iterations: $MAX_ITERATIONS"
echo "   Working directory: $(pwd)"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "═══════════════════════════════════════════"
  echo "  Iteration $i of $MAX_ITERATIONS"
  echo "═══════════════════════════════════════════"

  # Pipe prompt into Claude Code with dangerous permissions skip
  OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" \
    | claude --dangerously-skip-permissions 2>&1 \
    | tee /dev/stderr) || true

  # Check if Claude reported completion
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "✅ All tasks complete!"
    echo "   Check scripts/ralph/progress.txt for details"
    exit 0
  fi

  # Brief pause between iterations
  sleep 2
done

echo ""
echo "⚠️  Reached maximum iterations ($MAX_ITERATIONS)"
echo "   Check scripts/ralph/prd.json for remaining tasks"
echo "   Run again with higher limit if needed: ./scripts/ralph/ralph.sh 25"
exit 1
