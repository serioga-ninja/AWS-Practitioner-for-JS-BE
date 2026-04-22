# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Product Service endpoints

- `GET /products`
  - Lambda: `getProductsList`
  - Response: JSON array of products joined with stock from DynamoDB
  - Used by frontend PLP
- `POST /products`
  - Lambda: `createProduct`
  - Request body: `{ "title": string, "description": string, "price": number }`
  - Response: created product item from DynamoDB with generated `id`
- `GET /products/{productId}`
  - Lambda: `getProductsById`
  - Response: one matched product joined with stock from DynamoDB
  - Returns `404` when product is not found

After deploy, save the `ProductsApiUrl` CloudFormation output and include it in your PR description.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npm run cdk:deploy -- ProductServiceStack`  deploy Product Service stack
* `npx cdk diff ProductServiceStack`    compare Product Service stack changes
* `npx cdk synth ProductServiceStack`   synthesize Product Service template
