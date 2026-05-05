import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
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

    const createProduct = new lambda.Function(this, 'createProduct', {
      functionName: 'createProduct',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create-product-handler.main',
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
    this.productsTable.grantWriteData(createProduct);
    this.stockTable.grantReadData(getProductsList);
    this.stockTable.grantReadData(getProductsById);
    this.stockTable.grantWriteData(createProduct);

    // Create SQS queue for catalog items
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(4),
    });

    // Create catalogBatchProcess Lambda
    const catalogBatchProcess = new lambda.Function(this, 'catalogBatchProcess', {
      functionName: 'catalogBatchProcess',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'catalog-batch-process-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        PRODUCTS_TABLE_NAME: this.productsTable.tableName,
        STOCK_TABLE_NAME: this.stockTable.tableName,
      },
    });

    // Grant write permissions to catalogBatchProcess
    this.productsTable.grantWriteData(catalogBatchProcess);
    this.stockTable.grantWriteData(catalogBatchProcess);

    // Configure SQS as event source for catalogBatchProcess with batch size of 5
    catalogBatchProcess.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      })
    );

    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: catalogItemsQueue.queueUrl,
      description: 'URL of the Catalog Items SQS Queue',
    });

    new cdk.CfnOutput(this, 'CatalogItemsQueueArn', {
      value: catalogItemsQueue.queueArn,
      description: 'ARN of the Catalog Items SQS Queue',
    });

    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
      },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProduct));
    productsResource
      .addResource('{productId}')
      .addMethod('GET', new apigateway.LambdaIntegration(getProductsById));

    new cdk.CfnOutput(this, 'ProductsApiUrl', {
      value: `${api.url}products`,
      description: 'Products resource endpoint (GET list, POST create)',
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
