#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { AuthorizationServiceStack } from '../lib/authorization-service/authorization-service-stack';
import { ImportServiceStack } from '../lib/import-service/import-service-stack';
import { ProductServiceStack } from '../lib/product-service/product-service-stack';

const app = new cdk.App();

const authorizationServiceStack = new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const productServiceStack = new ProductServiceStack(app, 'ProductServiceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new ImportServiceStack(app, 'ImportServiceStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  catalogItemsQueue: productServiceStack.catalogItemsQueue,
  basicAuthorizerFunctionArn: authorizationServiceStack.basicAuthorizerFunction.functionArn,
});
