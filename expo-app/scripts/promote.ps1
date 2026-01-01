param(
  [Parameter(Mandatory=$true)][ValidateSet("preprod","prod")]$Env,
  [string]$Region = "ca-central-1",
  [string]$Release = ("release/" + (Get-Date -Format "yyyyMMdd")),
  [string]$BucketPreprod = "lola-preprod",
  [string]$BucketProd = "lola-prod",
  [string]$BuildDir = "web-build"
)

$ErrorActionPreference = "Stop"

function Ensure-CleanGit {
  $status = git status --porcelain
  if ($status) {
    throw "Git working tree is not clean. Commit/stash first."
  }
}

Write-Host "=== Promote to $Env ==="
Ensure-CleanGit

git fetch origin --prune

git checkout master
# Keep this early sync: publish the last successful local web build to a stable
# preprod bucket before we do any new build work.
aws s3 sync ".\$BuildDir\" "s3://lola-pre" --delete --region $Region
# Ensure local master is up-to-date and avoid interactive prompts.
git pull --ff-only origin master

# Merge from origin to avoid merging a stale local developSIT branch.
# --no-edit prevents Git from opening an editor for the merge commit message.
git merge --no-edit origin/developSIT

git checkout -b $Release

# Build (adjust command to your actual build)
# npm ci
npx expo export -p web --output-dir web-build

# Decide bucket
$bucket = if ($Env -eq "prod") { $BucketProd } else { $BucketPreprod }

Write-Host "Syncing $BuildDir -> s3://$bucket"
aws s3 sync ".\$BuildDir\" "s3://$bucket" --delete --region $Region
# aws s3 sync .\wegb-build\ s3://lola-prod --delete --region $region

# Optional: CloudFront invalidation (recommended)
aws cloudfront create-invalidation `
  --distribution-id E2CBKWKXA4R9J5 `
  --paths "/*"


git add -A
git commit -m $Release
git push -u origin $Release

Write-Host "Done. Release branch pushed: $Release"
