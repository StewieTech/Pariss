#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ENV_ALIAS=staging ./scripts/promote_alias.sh
#   ENV_ALIAS=preprod  ./scripts/promote_alias.sh
#   ENV_ALIAS=prod     ./scripts/promote_alias.sh
#
# Expects AWS creds & region configured, and function name "lola-api".
# Publishes a version, updates/creates the alias, ensures an alias-specific Function URL, and prints it.

REGION="${REGION:-ca-central-1}"
FUNC_NAME="${FUNC_NAME:-lola-api}"
ALIAS="${ENV_ALIAS:-staging}"

echo "Publishing new version for $FUNC_NAME in $REGION..."
VER=$(aws lambda publish-version --function-name "$FUNC_NAME" --region "$REGION" --query 'Version' --output text)
echo "Published version: $VER"

echo "Creating/updating alias: $ALIAS -> version $VER"
set +e
aws lambda get-alias --function-name "$FUNC_NAME" --name "$ALIAS" --region "$REGION" >/dev/null 2>&1
EXISTS=$?
set -e
if [ "$EXISTS" -eq 0 ]; then
  aws lambda update-alias --function-name "$FUNC_NAME" --name "$ALIAS" --function-version "$VER" --region "$REGION" >/dev/null
else
  aws lambda create-alias --function-name "$FUNC_NAME" --name "$ALIAS" --function-version "$VER" --region "$REGION" >/dev/null
fi
echo "Alias $ALIAS now points to version $VER"

# Ensure Function URL for this alias with broad CORS
echo "Ensuring Function URL for alias $ALIAS..."
set +e
aws lambda get-function-url-config --function-name "$FUNC_NAME" --qualifier "$ALIAS" --region "$REGION" >/dev/null 2>&1
URL_EXISTS=$?
set -e

if [ "$URL_EXISTS" -ne 0 ]; then
  URL=$(aws lambda create-function-url-config \
    --function-name "$FUNC_NAME" \
    --qualifier "$ALIAS" \
    --auth-type NONE \
    --cors 'AllowOrigins=["*"],AllowMethods=["GET","POST","OPTIONS"],AllowHeaders=["*"]' \
    --region "$REGION" \
    --query 'FunctionUrl' --output text)
  echo "Created Function URL: $URL"
else
  URL=$(aws lambda update-function-url-config \
    --function-name "$FUNC_NAME" \
    --qualifier "$ALIAS" \
    --auth-type NONE \
    --cors 'AllowOrigins=["*"],AllowMethods=["GET","POST","OPTIONS"],AllowHeaders=["*"]' \
    --region "$REGION" \
    --query 'FunctionUrl' --output text)
  echo "Updated Function URL: $URL"
fi

echo "::set-output name=function_url::$URL"  # for GitHub Actions (deprecated but still printed)
echo "Alias URL: $URL"
