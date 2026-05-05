import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { Construct } from 'constructs';
import { NODE_VERSION } from '../const';

export class ProductServiceStack extends cdk.Stack {
  public readonly productsTable: dynamodb.Table;
  public readonly stockTable: dynamodb.Table;
  public readonly catalogItemsQueue: sqs.Queue;

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
      runtime: NODE_VERSION,
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
      runtime: NODE_VERSION,
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
      runtime: NODE_VERSION,
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
    this.catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(4),
    });

    // Create SNS topic for product creation notifications
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
      displayName: 'Product Creation Notifications',
    });

    // Add email subscription to SNS topic from environment variable
    const subscriptionEmail = process.env.SNS_SUBSCRIPTION_EMAIL;
    if (subscriptionEmail) {
      createProductTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(subscriptionEmail)
      );
    } else {
      console.warn('SNS_SUBSCRIPTION_EMAIL environment variable not set. No email subscription will be created.');
    }

    // Create catalogBatchProcess Lambda
    const catalogBatchProcess = new lambda.Function(this, 'catalogBatchProcess', {
      functionName: 'catalogBatchProcess',
      runtime: NODE_VERSION,
      handler: 'catalog-batch-process-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        PRODUCTS_TABLE_NAME: this.productsTable.tableName,
        STOCK_TABLE_NAME: this.stockTable.tableName,
        CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    // Grant write permissions to catalogBatchProcess
    this.productsTable.grantWriteData(catalogBatchProcess);
    this.stockTable.grantWriteData(catalogBatchProcess);
    createProductTopic.grantPublish(catalogBatchProcess);

    // Configure SQS as event source for catalogBatchProcess with batch size of 5
    catalogBatchProcess.addEventSource(
      new lambdaEventSources.SqsEventSource(this.catalogItemsQueue, {
        batchSize: 5,
        reportBatchItemFailures: true,
      })
    );

    new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
      value: this.catalogItemsQueue.queueUrl,
      description: 'URL of the Catalog Items SQS Queue',
    });

    new cdk.CfnOutput(this, 'CatalogItemsQueueArn', {
      value: this.catalogItemsQueue.queueArn,
      description: 'ARN of the Catalog Items SQS Queue',
    });

    new cdk.CfnOutput(this, 'CreateProductTopicArn', {
      value: createProductTopic.topicArn,
      description: 'ARN of the Create Product SNS Topic',
    });

    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      },
    });

    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));
    productsResource.addMethod('POST', new apigateway.LambdaIntegration(createProduct));
    productsResource.addMethod('PUT', new apigateway.LambdaIntegration(createProduct));
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
