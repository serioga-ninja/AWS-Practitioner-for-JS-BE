import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import { Construct } from 'constructs';
import { NODE_VERSION } from '../const';

export interface ImportServiceStackProps extends cdk.StackProps {
  catalogItemsQueue: sqs.Queue;
}

export class ImportServiceStack extends cdk.Stack {
  public readonly importBucket: s3.Bucket;
  public readonly importProductsFile: lambda.Function;
  public readonly importFileParser: lambda.Function;

  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    this.importBucket = new s3.Bucket(this, 'ImportBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    // S3 has logical prefixes, so create a placeholder object under uploaded/.
    new s3deploy.BucketDeployment(this, 'UploadedPrefixDeployment', {
      destinationBucket: this.importBucket,
      sources: [s3deploy.Source.data('uploaded/.keep', '')],
      prune: false,
    });

    this.importProductsFile = new lambda.Function(this, 'ImportProductsFileLambda', {
      functionName: 'importProductsFile',
      runtime: NODE_VERSION,
      handler: 'import-products-file-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        IMPORT_BUCKET_NAME: this.importBucket.bucketName,
        UPLOADED_PREFIX: 'uploaded/',
      },
    });

    this.importBucket.grantPut(this.importProductsFile, 'uploaded/*');

    this.importFileParser = new NodejsFunction(this, 'ImportFileParserLambda', {
      functionName: 'importFileParser',
      runtime: NODE_VERSION,
      handler: 'main',
      entry: path.join(__dirname, './import-file-parser-handler.ts'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CATALOG_ITEMS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    this.importBucket.grantRead(this.importFileParser, 'uploaded/*');
    this.importBucket.grantDelete(this.importFileParser, 'uploaded/*');
    this.importBucket.grantPut(this.importFileParser, 'parsed/*');
    props.catalogItemsQueue.grantSendMessages(this.importFileParser);

    this.importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.importFileParser),
      { prefix: 'uploaded/' },
    );

    const api = new apigateway.RestApi(this, 'ImportServiceApi', {
      restApiName: 'Import Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
      },
    });

    api.root
      .addResource('import')
      .addMethod('GET', new apigateway.LambdaIntegration(this.importProductsFile));

    new cdk.CfnOutput(this, 'ImportBucketName', {
      value: this.importBucket.bucketName,
      description: 'S3 bucket name for import files',
    });

    new cdk.CfnOutput(this, 'UploadedPrefix', {
      value: 'uploaded/',
      description: 'Prefix used for uploaded files in the import bucket',
    });

    new cdk.CfnOutput(this, 'ImportApiUrl', {
      value: `${api.url}import`,
      description: 'Import endpoint to request pre-signed S3 upload URLs',
    });
  }
}
