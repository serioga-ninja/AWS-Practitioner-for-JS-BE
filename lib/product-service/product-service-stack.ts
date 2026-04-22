import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsList = new lambda.Function(this, 'getProductsList', {
      functionName: 'getProductsList',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-products-list-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
    });

    const getProductsById = new lambda.Function(this, 'getProductsById', {
      functionName: 'getProductsById',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-products-by-id-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
    });

    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
      },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));
    productsResource
      .addResource('{productId}')
      .addMethod('GET', new apigateway.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: `${api.url}products`,
      description: 'GET endpoint for Product List Page integration',
    });
  }
}
