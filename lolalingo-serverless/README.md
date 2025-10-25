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
aws sts get-caller-identity --region ca-central-1
aws configure --profile asklolaai
$env:AWS_PROFILE = 'asklolaai'
$region = 'ca-central-1'
$func='lola-api'

$bucket = 'lolalingo-staging-serverlessdeploymentbucket-dbxctmcuvqve'
# create bucket
aws s3api create-bucket --bucket $bucket --region $region --create-bucket-configuration LocationConstraint=$region

# block public access (recommended) (didnèt do this step)
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' --region $region

# enable AES256 default encryption (recommended)
aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' --region $region

# removes broken stack
<!-- npx serverless remove --stage staging --region $region --aws-profile asklolaai  I would of thought it was this one for sure--> 
<!-- npx serverless remove --stage staging --region $region  -->

## First-time setup
```bash
npm ci
# Create SSM params for OpenAI keys (replace values) (haven't dont this one yet)
./scripts/setup_ssm.sh

# Build & deploy the base stack
npm run build
# npx serverless deploy --region ca-central-1 --stage staging # I would of thought it was this one for sure
npx serverless deploy --region ca-central-1
npx serverless deploy --region ca-central-1 --stage dev --aws-profile asklolaai


$env:EXPO_API_URL='https://<prod-function-url>'; expo export:web
aws s3 sync .\web-build\ s3://lola-frontend-prod --delete --region ca-central-1

# publish + alias + alias-URL (promote script)
## This publishes a new version apparently
$ver = aws lambda publish-version --function-name lola-api --region $region --query 'Version' --output text
$ver = aws lambda publish-version --function-name lola-prod --region $region --query 'Version' --output text

## here is where I would change the name to staging | prod | preprod -> this creates or updates alias
aws lambda create-alias --function-name lola-api --name lola-prod --function-version $ver --region $region 2>$null || aws lambda update-alias --function-name lola-prod --name staging --function-version $ver --region $region

aws lambda get-function-url-config --function-name lola-api --qualifier staging --profile asklolaai --region ca-central-1

aws lambda create-function-url-config --function-name lola-prod --qualifier lola-prod --auth-type NONE --cors 'AllowOrigins=["*"],AllowMethods=["GET","POST","OPTIONS"],AllowHeaders=["*"]' --region $region --query 'FunctionUrl' --output text

# Point STAGING alias at the new version and create its Function URL
$env:ENV_ALIAS='staging'; bash ./scripts/promote_alias.sh
$env:ENV_ALIAS='prod'; bash ./scripts/promote_alias.sh


How promotions work

- Pushes to `develop` run deploy + map alias `staging`.
- Tags matching `vYYYY.MM.DD-rcN` will deploy and set alias `preprod`.
- Tags matching `vYYYY.MM.DD` will require a manual gate and then set alias `prod`.

### Notes
cd "C:\Users\Errol\Dropbox\Harvard CS50\StewieTech Portfolio\Backend\LolaInParis\serverless"
Get-ChildItem -Recurse -File | Select-Object FullName

### Check if Works
# PowerShell native
Invoke-RestMethod -Uri 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws/health' -Method GET

$body = @{ text='hello'; mode='m1' } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws/chat/send' -Method POST -Body $body -ContentType 'application/json'

$body = @{ text = 'How are you?' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://192.168.2.44:4000/chat/translate' -Method POST -Body $body -ContentType 'application/json'

Invoke-RestMethod -Uri 'hhttps://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws/chat/translate' -Method POST -Body $body -ContentType 'application/json'


http://192.168.2.44:4000

# call endpoint, get base64 text, write to file
$b64 = Invoke-RestMethod -Method Post -Uri http://192.168.2.44:4000/chat/tts -Body (@{ text = 'Bonjour'; voiceId = 'LEnmbrrxYsUYS7vsRRwD' } | ConvertTo-Json) -ContentType 'application/json'
[System.IO.File]::WriteAllBytes('bonjour.mp3',[Convert]::FromBase64String($b64))