# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Product Service endpoint

- Method: `GET`
- Path: `/products`
- Lambda: `getProductsList`
- Response: JSON array of mock products from `lib/product-service/mock-products.ts`

After deploy, use the `ProductsApiUrl` CloudFormation output as the frontend PLP API URL.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npm run cdk:deploy -- ProductServiceStack`  deploy Product Service stack
* `npx cdk diff ProductServiceStack`    compare Product Service stack changes
* `npx cdk synth ProductServiceStack`   synthesize Product Service template
