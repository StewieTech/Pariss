LolaLingo Serverless

Minimal Serverless Framework project using a single Node 20 Lambda with Function URLs and aliases for environments.

How to set SSM params
1. Use the AWS CLI to put a parameter (example for preprod):

```bash
aws ssm put-parameter --name /lola/preprod/OPENAI_API_KEY --value "sk-REDACTED" --type SecureString --overwrite
```

First deploy (local)

```bash
cd serverless
# install deps
npm ci
# build and deploy
npm run build
npx serverless deploy --stage preprod
# after deploy, run the postdeploy helper to publish and map alias
node scripts/postdeploy.js preprod
```

How promotions work

- Pushes to `develop` run deploy + map alias `staging`.
- Tags matching `vYYYY.MM.DD-rcN` will deploy and set alias `preprod`.
- Tags matching `vYYYY.MM.DD` will require a manual gate and then set alias `prod`.
