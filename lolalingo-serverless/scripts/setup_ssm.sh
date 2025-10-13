#!/usr/bin/env bash
set -euo pipefail
REGION="${REGION:-ca-central-1}"

# Create/Update SSM params for each environment (use your real key values)
declare -a ENVS=("prod" "staging" "preprod")

for E in "${ENVS[@]}"; do
  echo "Setting SSM /lola/${E}/OPENAI_API_KEY ..."
  aws ssm put-parameter \
    --name "/lola/${E}/OPENAI_API_KEY" \
    --type "SecureString" \
    --value "REPLACE_WITH_YOUR_OPENAI_KEY_FOR_${E}" \
    --overwrite \
    --region "$REGION" >/dev/null
done

echo "Done."
