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
$profile = 'asklolaai'

$func='lola-api'
$alias='prod'
$funcUrl = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws/chat/translate'
$origin = 'http://lola-frontend.s3-website.ca-central-1.amazonaws.com'
$alias = 'prod'   # or 'prod' or the alias name your function URL uses
aws lambda update-alias --function-name $func --name $alias --function-version $ver --region $region

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

# publish + alias + alias-URL (promote script)
## This publishes a new version apparently
$ver = aws lambda publish-version --function-name lola-api --region $region --query 'Version' --output text
$ver = aws lambda publish-version --function-name lola-prod --region $region --query 'Version' --output text

## here is where I would change the name to staging | prod | preprod -> this creates or updates alias
aws lambda create-alias --function-name lola-api --name lola-prod --function-version $ver --region $region 2>$null ||
aws lambda update-alias --function-name lola-prod --name staging --function-version $ver --region $region

aws lambda get-function-url-config --function-name lola-api --qualifier staging --profile asklolaai --region ca-central-1

aws lambda create-function-url-config --function-name lola-prod --qualifier lola-prod --auth-type NONE --cors 'AllowOrigins=["*"],AllowMethods=["GET","POST","OPTIONS"],AllowHeaders=["*"]' --region $region --query 'FunctionUrl' --output text

## CORS
aws lambda update-function-url-config --function-name lola-api --cors AllowOrigins="['http://lola-frontend.s3-website.ca-central-1.amazonaws.com']" --region ca-central-1

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


# create/overwrite the secure SSM parameter for the 'staging' alias
aws ssm put-parameter --name "/lola/staging/ELEVEN_API_KEY" --value "sk-REPLACE_WITH_YOUR_KEY" --type SecureString --overwrite --region ca-central-1 --profile asklolaai
aws ssm put-parameter --name "/lola/staging/MONGODB_URI" --value "$mongoUri" --type SecureString --overwrite --region ca-central-1 --profile asklolaai
aws ssm put-parameter --name "/lola/prod/MONGODB_URI" --value "$mongoUri" --type SecureString --overwrite --region ca-central-1 --profile asklolaai
aws ssm put-parameter --name "/lola/staging/MONGODB_DB" --value "paris_dev" --type String --overwrite --region ca-central-1 --profile asklolaai
aws ssm put-parameter --name "/lola/prod/MONGODB_DB" --value "paris_dev" --type String --overwrite --region ca-central-1 --profile asklolaai
aws ssm put-parameter --name "/lola/staging/JWT_SECRET" --value "fungoose" --type String --overwrite --region ca-central-1 --profile asklolaai
aws ssm put-parameter --name "/lola/prod/JWT_SECRET" --value "fungoose" --type String --overwrite --region ca-central-1 --profile asklolaai

# optional: set default voice id too (plain string)
aws ssm put-parameter --name "/lola/staging/ELEVEN_VOICE_ID" --value "LEnmbrrxYsUYS7vsRRwD" --type String --overwrite --region ca-central-1 --profile asklolaai

# verify it's present (with decryption)
aws ssm get-parameter --name "/lola/staging/ELEVEN_API_KEY" --with-decryption --region ca-central-1 --profile asklolaai


# Update the Function URL to require AWS_IAM and set CORS for your origin
aws lambda update-function-url-config `
  --function-name $func `
  --auth-type AWS_IAM `
  --cors "AllowOrigins=['$origin'],AllowMethods=['GET','POST','OPTIONS'],AllowHeaders=['*']" `
  --region $region


  $func   = 'lola-api'
$region = 'ca-central-1'
$origin = 'http://lola-frontend.s3-website.ca-central-1.amazonaws.com'

# Build CORS JSON safely
$cors = '{ "AllowOrigins": ["' + $origin + '"], "AllowMethods": ["GET","POST","OPTIONS"], "AllowHeaders": ["*"] }'

# Update function-url to auth NONE and set CORS
aws lambda update-function-url-config --function-name $func --auth-type NONE --cors $cors --region $region

$funcUrl = 'https://rtvfwmc7qd3p3shvzwb5pyliiy0fdvfo.lambda-url.ca-central-1.on.aws/chat/translate'
$funcUrl = 'https://37aouuy2ay3uwseeipasynah640sxqcp.lambda-url.ca-central-1.on.aws/'

$origin = 'http://lola-frontend.s3-website.ca-central-1.amazonaws.com'

curl.exe -i -X OPTIONS $funcUrl -H "Origin: $origin" -H "Access-Control-Request-Method: POST"

## publishes latest code as an immutable version
$ver = aws lambda publish-version --function-name $func --region $region --query 'Version' --output text
Write-Host "Published version: $ver"

## Update the prod alias to point to the newly published version
aws lambda update-alias --function-name $func --name $alias --function-version $ver --region $region
Write-Host "Alias '$alias' updated to version $ver"

aws lambda get-function-url-config --function-name $func --qualifier $alias --region $region | ConvertFrom-Json | Select-Object FunctionUrl, AuthType, Cors, Qualifier

$cors = '{ "AllowOrigins": ["' + $origin + '"], "AllowMethods": ["GET","POST","OPTIONS"], "AllowHeaders": ["*"] }'

# Update (targeting the URL bound to the alias)
aws lambda update-function-url-config --function-name $func --qualifier $alias --cors $cors --region $region