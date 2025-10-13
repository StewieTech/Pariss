#!/usr/bin/env bash
set -euo pipefail
echo "This script is a thin helper. Files have already been created in ./serverless/ by the assistant." 
echo "See serverless/README.md for usage."
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="lolalingo-serverless"
REGION="ca-central-1"
FUNC_NAME="lola-api"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

# ---------- .gitignore ----------
cat > .gitignore <<'EOF'
node_modules
dist
.serverless
.esbuild
.env
.DS_Store
EOF

# ---------- package.json ----------
cat > package.json <<'EOF'
{
  "name": "lolalingo-serverless",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "esbuild src/handler.ts --bundle --platform=node --target=node20 --outfile=dist/handler.js",
    "deploy": "npm run build && npx serverless deploy",
    "start": "node dist/handler.js"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.136",
    "esbuild": "^0.23.0",
    "serverless": "^3.39.0",
    "typescript": "^5.6.3"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.635.0",
    "@aws-sdk/client-lambda": "^3.635.0",
    "@aws-sdk/client-ssm": "^3.635.0"
  }
}
EOF

# ---------- tsconfig.json ----------
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
EOF

# ---------- serverless.yml ----------
cat > serverless.yml <<'EOF'
service: lolalingo
frameworkVersion: "3"

provider:
  name: aws
  runtime: nodejs20.x
  region: ca-central-1
  stage: dev
  memorySize: 256
  architecture: arm64
  environment:
    DDB_TABLE: lola_app
    # Alias name injected at deploy/promote time (prod|staging|preprod)
    ENV_ALIAS: ${env:ENV_ALIAS, 'staging'}

package:
  individually: false
  patterns:
    - "!**/*"
    - "dist/**"

functions:
  api:
    name: lola-api
    handler: dist/handler.http
    # Function URL (base one; alias-specific URLs are created via post-deploy script)
    url: true
    # No events here (we use Function URLs to stay ultra-cheap)
    # CORS tuning is done when alias URLs are created

resources:
  Resources:
    LolaTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: lola_app
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - AttributeName: PK
            AttributeType: S
          - AttributeName: SK
            AttributeType: S
        KeySchema:
          - AttributeName: PK
            KeyType: HASH
          - AttributeName: SK
            KeyType: RANGE
EOF

# ---------- src/handler.ts ----------
mkdir -p src
cat > src/handler.ts <<'EOF'
import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

type Req = {
  rawPath?: string;
  requestContext?: { http?: { method?: string; path?: string } };
  body?: string;
  headers?: Record<string, string>;
};

const ssm = new SSMClient({});

async function getParam(name: string, withDecryption = true) {
  const cmd = new GetParameterCommand({ Name: name, WithDecryption: withDecryption });
  try {
    const out = await ssm.send(cmd);
    return out.Parameter?.Value ?? "";
  } catch {
    return "";
  }
}

function json(statusCode: number, data: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "*"
    },
    body: JSON.stringify(data)
  };
}

// Single Lambda "http" entry compatible with Function URLs
export async function http(event: Req, _ctx: Context): Promise<APIGatewayProxyResult> {
  const method = event?.requestContext?.http?.method || "GET";
  const path = event?.rawPath || event?.requestContext?.http?.path || "/";

  if (method === "OPTIONS") return json(204, {});

  if (path === "/health") {
    return json(200, { ok: true, env: process.env.ENV_ALIAS || "unknown" });
  }

  if (path === "/chat/send" && method === "POST") {
    let payload: any = {};
    try { payload = event.body ? JSON.parse(event.body) : {}; } catch {}
    const envAlias = process.env.ENV_ALIAS || "staging";

    // Read OPENAI key for this env (optional for now)
    const keyPath = `/lola/${envAlias}/OPENAI_API_KEY`;
    const openaiKey = await getParam(keyPath, true);

    // Echo until you wire the real OpenAI call:
    return json(200, {
      message: "stubbed reply (replace with OpenAI call)",
      received: payload,
      envAlias,
      hasOpenAIKey: Boolean(openaiKey)
    });
  }

  return json(404, { error: "Not Found", path, method });
}
EOF

# ---------- scripts/promote_alias.sh ----------
mkdir -p scripts
cat > scripts/promote_alias.sh <<'EOF'
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
EOF
chmod +x scripts/promote_alias.sh

# ---------- scripts/setup_ssm.sh ----------
cat > scripts/setup_ssm.sh <<'EOF'
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
EOF
chmod +x scripts/setup_ssm.sh

# ---------- .github/workflows/cicd.yml ----------
mkdir -p .github/workflows
cat > .github/workflows/cicd.yml <<'EOF'
name: CI/CD (LolaLingo Serverless)

on:
  push:
    branches: [ develop, main ]
    tags: [ 'v*' ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install
        run: npm ci
      - name: Build
        run: npm run build
      - name: Serverless Deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_REGION || 'ca-central-1' }}
          ENV_ALIAS: staging
        run: npx serverless deploy --region ${AWS_REGION}

  promote-staging:
    if: github.ref == 'refs/heads/develop'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps
        run: npm ci
      - name: Promote to STAGING alias
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_REGION || 'ca-central-1' }}
          ENV_ALIAS: staging
        run: ./scripts/promote_alias.sh

  promote-preprod:
    # Any tag like v2025.10.10-rc1 (contains '-rc')
    if: startsWith(github.ref, 'refs/tags/v') && contains(github.ref, '-rc')
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps
        run: npm ci
      - name: Promote to PREPROD alias
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_REGION || 'ca-central-1' }}
          ENV_ALIAS: preprod
        run: ./scripts/promote_alias.sh

  promote-prod:
    # Production tag like v2025.10.10 (no '-rc')
    if: startsWith(github.ref, 'refs/tags/v') && !contains(github.ref, '-rc')
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: production
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install deps
        run: npm ci
      - name: Promote to PROD alias
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_REGION || 'ca-central-1' }}
          ENV_ALIAS: prod
        run: ./scripts/promote_alias.sh
EOF

# ---------- README.md ----------
cat > README.md <<'EOF'
# LolaLingo — Ultra-low-cost AWS Serverless

Single Lambda (Node 20, TypeScript) + **Lambda Function URLs** (no API Gateway).  
Three environments via **Lambda aliases**: `staging` (develop), `preprod` (RC tags), `prod` (release tags).

## Prereqs
- AWS account + IAM user with Lambda, SSM, DynamoDB permissions
- AWS CLI configured (`aws configure`)
- Node 20, npm
- (CI) GitHub Secrets set: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (optional; defaults to ca-central-1)

## First-time setup
```bash
npm ci
# Create SSM params for OpenAI keys (replace values)
./scripts/setup_ssm.sh

# Build & deploy the base stack
npm run build
npx serverless deploy --region ca-central-1

# Point STAGING alias at the new version and create its Function URL
ENV_ALIAS=staging ./scripts/promote_alias.sh
