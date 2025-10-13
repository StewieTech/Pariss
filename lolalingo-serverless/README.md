# LolaLingo — Ultra-low-cost AWS Serverless

Single Lambda (Node 20, TypeScript) + **Lambda Function URLs** (no API Gateway).  
Three environments via **Lambda aliases**: `staging` (develop), `preprod` (RC tags), `prod` (release tags).


## Prereqs (Need to Update this section)
- AWS account + IAM user with Lambda, SSM, DynamoDB permissions
- AWS CLI configured (`aws configure`)
- Node 20, npm
- (CI) GitHub Secrets set: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` (optional; defaults to ca-central-1)

# S3
lolalingo-staging-serverlessdeploymentbucket-dbxctmcuvqve       ServerlessDeploymentBucket

aws s3api head-bucket --bucket lolalingo-staging-serverlessdeploymentbucket-dbxctmcuvqve --region $region; if ($LASTEXITCODE -eq 0) { Write-Output 'Bucket exists' } else { Write-Output 'Bucket missing or permission denied' }

# set profile/region
$env:AWS_PROFILE = 'asklolaai'
$region = 'ca-central-1'
$bucket = 'lolalingo-staging-serverlessdeploymentbucket-dbxctmcuvqve'
$func='lola-api'

# create bucket
aws s3api create-bucket --bucket $bucket --region $region --create-bucket-configuration LocationConstraint=$region

# block public access (recommended) (didnèt do this step)
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' --region $region

# enable AES256 default encryption (recommended)
aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' --region $region

# removes broken stack
npx serverless remove --stage staging --region $region

## First-time setup
```bash
npm ci
# Create SSM params for OpenAI keys (replace values) (haven't dont this one yet)
./scripts/setup_ssm.sh

# Build & deploy the base stack
npm run build
npx serverless deploy --region ca-central-1

# publish + alias + alias-URL (promote script)
# If using PowerShell (AWS CLI):
$ver = aws lambda publish-version --function-name lola-api --region $region --query 'Version' --output text
aws lambda create-alias --function-name lola-api --name staging --function-version $ver --region $region 2>$null || aws lambda update-alias --function-name lola-api --name staging --function-version $ver --region $region
aws lambda create-function-url-config --function-name lola-api --qualifier staging --auth-type NONE --cors 'AllowOrigins=["*"],AllowMethods=["GET","POST","OPTIONS"],AllowHeaders=["*"]' --region $region --query 'FunctionUrl' --output text

# Point STAGING alias at the new version and create its Function URL
ENV_ALIAS=staging ./scripts/promote_alias.sh
