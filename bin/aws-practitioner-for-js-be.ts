#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { HelloLambdaStack } from '../lib/hello-lambda/hello-lambda-stack';
import { ProductServiceStack } from '../lib/product-service/product-service-stack';

const app = new cdk.App();

new HelloLambdaStack(app, 'HelloLambdaStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new ProductServiceStack(app, 'ProductServiceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
