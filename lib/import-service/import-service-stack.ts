import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'path';
import { Construct } from 'constructs';

export class ImportServiceStack extends cdk.Stack {
  public readonly importBucket: s3.Bucket;
  public readonly importProductsFile: lambda.Function;
  public readonly importFileParser: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
	  runtime: lambda.Runtime.NODEJS_20_X,
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

	this.importFileParser = new lambda.Function(this, 'ImportFileParserLambda', {
	  functionName: 'importFileParser',
	  runtime: lambda.Runtime.NODEJS_20_X,
	  handler: 'import-file-parser-handler.main',
	  code: lambda.Code.fromAsset(path.join(__dirname, './')),
	  memorySize: 128,
	  timeout: cdk.Duration.seconds(10),
	});

	this.importBucket.grantRead(this.importFileParser, 'uploaded/*');
	this.importBucket.addEventNotification(
	  s3.EventType.OBJECT_CREATED,
	  new s3n.LambdaDestination(this.importFileParser),
	  { prefix: 'uploaded/' }
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
