#!/usr/bin/env bash
# Do NOT use set -e — test failures must not abort before emitting JSON.

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.toolArgs.path // empty')
[[ -z "$FILE" ]] && exit 0

case "$FILE" in
  *.cs)
    echo '{"type":"progress","message":"Running .NET tests..."}'
    OUTPUT=$(dotnet test services/assets-svc/Tests/AssetsService.Tests.csproj -q 2>&1 | tail -20) || true ;;
  *.java)
    echo '{"type":"progress","message":"Running Java tests..."}'
    OUTPUT=$(cd services/workforce-svc && mvn -q test --no-transfer-progress 2>&1 | tail -20) || true ;;
  *.py)
    echo '{"type":"progress","message":"Running Python tests..."}'
    OUTPUT=$(cd services/reporting-svc && pytest -q 2>&1 | tail -20) || true ;;
  *.ts|*.tsx|*.astro)
    echo '{"type":"progress","message":"Running Playwright tests..."}'
    OUTPUT=$(cd services/web && npm run test:e2e --silent 2>&1 | tail -20) || true ;;
  *) exit 0 ;;
esac

# Use jq to build output — string interpolation breaks on quotes, newlines and backslashes.
jq -n --arg ctx "Test output for $FILE:"$'\n'"$OUTPUT" '{"additionalContext": $ctx}'