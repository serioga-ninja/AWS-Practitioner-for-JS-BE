#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { ImportServiceStack } from '../lib/import-service/import-service-stack';
import { ProductServiceStack } from '../lib/product-service/product-service-stack';

const app = new cdk.App();

new ProductServiceStack(app, 'ProductServiceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new ImportServiceStack(app, 'ImportServiceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
