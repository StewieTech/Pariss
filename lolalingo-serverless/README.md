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
