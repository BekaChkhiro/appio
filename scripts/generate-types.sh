#!/bin/bash
set -euo pipefail

# Generate TypeScript types from FastAPI OpenAPI spec
# Requires: API running on localhost:8000, openapi-typescript installed

echo "Fetching OpenAPI spec from localhost:8000..."
curl -sf http://localhost:8000/openapi.json -o /tmp/openapi.json

echo "Generating TypeScript types..."
npx openapi-typescript /tmp/openapi.json -o packages/ui/src/api-types.ts

echo "Types generated at packages/ui/src/api-types.ts"
