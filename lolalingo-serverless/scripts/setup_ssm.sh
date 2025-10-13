#!/usr/bin/env bash
set -euo pipefail
REGION="${REGION:-ca-central-1}"
APIKEY="${OPENAI_API_KEY:-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}"

# Create/Update SSM params for each environment (use your real key values)
declare -a ENVS=("prod" "staging" "preprod")

for E in "${ENVS[@]}"; do
  echo "Setting SSM /lola/${E}/OPENAI_API_KEY ..."
  aws ssm put-parameter \
    --name "/lola/${E}/OPENAI_API_KEY" \
    --type "SecureString" \
    --value "$APIKEY${E}" \
    --overwrite \
    --region "$REGION" >/dev/null
done

echo "Done."
