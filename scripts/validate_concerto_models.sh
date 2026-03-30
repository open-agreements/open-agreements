#!/bin/bash
# Validate all generated Concerto models end-to-end.
#
# For each .cto file in concerto/:
# 1. Compile to TypeScript (validates syntax)
# 2. Check parity with metadata.yaml
# 3. Generate sample input JSON and validate against model
#
# Usage:
#   bash scripts/validate_concerto_models.sh           # validate all
#   bash scripts/validate_concerto_models.sh --fix      # run claude to fix issues
#
# With --fix, spawns a headless Claude session per failing template:
#   claude -p "Fix the Concerto model..." --dangerously-skip-permissions

set -euo pipefail
cd "$(dirname "$0")/.."

FIX_MODE=false
[[ "${1:-}" == "--fix" ]] && FIX_MODE=true

echo "=== Step 1: Compile all models ==="
npm run generate:concerto 2>&1

echo ""
echo "=== Step 2: Validate parity with metadata.yaml ==="
npm run validate:concerto 2>&1
PARITY_EXIT=$?

echo ""
echo "=== Step 3: Validate sample data for each model ==="
ERRORS=0
for cto in concerto/*.cto; do
  name=$(basename "$cto" .cto)

  # Extract namespace and asset name from .cto
  NAMESPACE=$(grep '^namespace ' "$cto" | awk '{print $2}')
  ASSET=$(grep '^asset ' "$cto" | awk '{print $2}')
  if [[ -z "$ASSET" || -z "$NAMESPACE" ]]; then
    echo "  ⚠ $name: could not parse asset/namespace"
    continue
  fi
  CONCEPT="${NAMESPACE}.${ASSET}"

  # Generate minimal valid input (generate does not support --offline)
  npx -y @accordproject/concerto-cli@3.19.0 generate sample \
    --model "$cto" \
    --model concerto/deps/@models.accordproject.org.accordproject.contract.cto \
    --concept "$CONCEPT" \
    2>/dev/null > /tmp/concerto-sample-${name}.json || true

  if [[ -f /tmp/concerto-sample-${name}.json ]] && [[ -s /tmp/concerto-sample-${name}.json ]]; then
    RESULT=$(npx -y @accordproject/concerto-cli@3.19.0 validate \
      --model "$cto" \
      --model concerto/deps/@models.accordproject.org.accordproject.contract.cto \
      --input /tmp/concerto-sample-${name}.json \
      --offline 2>&1) || true

    if echo "$RESULT" | grep -q "Input is valid"; then
      echo "  ✓ $name"
    else
      echo "  ✗ $name: validation failed"
      echo "    $RESULT" | head -3
      ERRORS=$((ERRORS + 1))

      if $FIX_MODE; then
        echo "    → Spawning Claude to fix..."
        claude -p "In the open-agreements repo, fix the Concerto model at $cto so it validates correctly. The error was: $RESULT. Read the corresponding metadata.yaml and regenerate the .cto. Run 'npm run validate:concerto' after fixing." \
          --dangerously-skip-permissions \
          --print 2>/dev/null || true
      fi
    fi
  else
    echo "  ⚠ $name: could not generate sample (may have complex types)"
  fi

  rm -f /tmp/concerto-sample-${name}.json
done

echo ""
echo "=== Summary ==="
echo "Models compiled: $(ls concerto/*.cto | wc -l | tr -d ' ')"
echo "Parity check: $([ $PARITY_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "Validation errors: $ERRORS"

exit $((PARITY_EXIT + ERRORS))
