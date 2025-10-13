#!/usr/bin/env node
const { LambdaClient, PublishVersionCommand, UpdateAliasCommand, CreateAliasCommand, GetAliasCommand, CreateFunctionUrlConfigCommand, GetFunctionUrlConfigCommand } = require('@aws-sdk/client-lambda');
const region = process.env.AWS_REGION || 'ca-central-1';
const stage = process.argv[2] || process.env.STAGE || 'preprod';
const client = new LambdaClient({ region });

async function ensureAlias(functionName, alias) {
  try {
    await client.send(new GetAliasCommand({ FunctionName: functionName, Name: alias }));
    return true;
  } catch (e) {
    await client.send(new CreateAliasCommand({ FunctionName: functionName, Name: alias, FunctionVersion: '$LATEST', Description: `alias ${alias}` }));
    return true;
  }
}

async function publishAndAlias() {
  const functionName = `${process.env.npm_package_name || 'lolalingo'}-${stage}-lola-api`;
  const pub = await client.send(new PublishVersionCommand({ FunctionName: functionName }));
  const version = pub.Version;
  // choose alias mapping rules external to this script when called by CI
  const alias = process.env.TARGET_ALIAS || stage;
  try {
    await client.send(new UpdateAliasCommand({ FunctionName: functionName, Name: alias, FunctionVersion: version }));
  } catch (e) {
    await client.send(new CreateAliasCommand({ FunctionName: functionName, Name: alias, FunctionVersion: version }));
  }

  // ensure Function URL exists for the alias
  const urlConfig = {
    AuthType: 'NONE',
    Cors: { AllowOrigins: ['*'], AllowMethods: ['GET', 'POST'], AllowHeaders: ['*'] }
  };
  const funcForUrl = `${functionName}:${alias}`;
  try {
    await client.send(new GetFunctionUrlConfigCommand({ FunctionName: funcForUrl }));
    console.log('Function URL already exists for', funcForUrl);
  } catch (e) {
    const c = await client.send(new CreateFunctionUrlConfigCommand({ FunctionName: funcForUrl, ...urlConfig }));
    console.log('Created Function URL:', c.FunctionUrl);
  }
  console.log('Published version', version, 'and aliased to', alias);
}

publishAndAlias().catch((err)=>{ console.error(err); process.exit(1); });
