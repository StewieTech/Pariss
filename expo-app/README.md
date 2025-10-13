Lola Expo Demo

Run the Expo app (Fast Refresh enabled by default):

```powershell
cd expo-app
npm install
npm run dev
```

Notes:
- `dev` uses `expo start --dev-client` to enable development client workflows.
- If testing on a physical device, replace the API host in `App.tsx` with your machine IP, e.g. `http://192.168.1.5:4000`.

## AWS
# quick check which profile is active and who you are
aws configure list
aws sts get-caller-identity --profile asklolaai

$env:AWS_PROFILE='asklolaai'
$region='ca-central-1'
$bucket='lola-frontend'

aws s3api create-bucket --bucket $bucket --region $region --create-bucket-configuration LocationConstraint=$region
aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' --region $region
aws s3api put-bucket-encryption --bucket $bucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' --region $region

## Build
cd .\expo-app
# build/export static web (tooling differs by Expo SDK; try one)
npx expo export:web

# sync to S3
aws s3 sync .\web-build\ s3://lola-frontend --delete --region $region


# enable static website hosting (optional; S3 website has HTTP only)
aws s3 website s3://lola-frontend --index-document index.html --error-document index.html

# S3 website URL:
Write-Output "http://$bucket.s3-website-$region.amazonaws.com"

# enable static website hosting (or prefer CloudFront)
aws s3 website s3://lola-frontend --index-document index.html --error-document index.html

http://lola-frontend.s3-website.ca-central-1.amazonaws.com/


# ToDo

# Prototype
- Have a working app for Delly and Kennick to Test
- fix lambda server functions

# MVP
- Have all three staging prod and preprod versions working
- have automatic promotions based on tagging? 
