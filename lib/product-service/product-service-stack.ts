import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
  public readonly productsTable: dynamodb.Table;
  public readonly stockTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB Products Table
    this.productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'products',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create DynamoDB Stock Table
    this.stockTable = new dynamodb.Table(this, 'StockTable', {
      tableName: 'stock',
      partitionKey: {
        name: 'product_id',
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const getProductsList = new lambda.Function(this, 'getProductsList', {
      functionName: 'getProductsList',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-products-list-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        PRODUCTS_TABLE_NAME: this.productsTable.tableName,
        STOCK_TABLE_NAME: this.stockTable.tableName,
      },
    });

    const getProductsById = new lambda.Function(this, 'getProductsById', {
      functionName: 'getProductsById',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get-products-by-id-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        PRODUCTS_TABLE_NAME: this.productsTable.tableName,
        STOCK_TABLE_NAME: this.stockTable.tableName,
      },
    });

    // Grant Lambda functions read access to DynamoDB tables
    this.productsTable.grantReadData(getProductsList);
    this.productsTable.grantReadData(getProductsById);
    this.stockTable.grantReadData(getProductsList);
    this.stockTable.grantReadData(getProductsById);

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

    new cdk.CfnOutput(this, 'ProductsTableName', {
      value: this.productsTable.tableName,
      description: 'Name of the Products DynamoDB table',
    });

    new cdk.CfnOutput(this, 'StockTableName', {
      value: this.stockTable.tableName,
      description: 'Name of the Stock DynamoDB table',
    });
  }
}
