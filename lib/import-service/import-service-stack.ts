import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class ImportServiceStack extends cdk.Stack {
  public readonly importBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
	super(scope, id, props);

	this.importBucket = new s3.Bucket(this, 'ImportBucket', {
	  removalPolicy: cdk.RemovalPolicy.DESTROY,
	  autoDeleteObjects: true,
	  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
	  enforceSSL: true,
	});

	// S3 has logical prefixes, so create a placeholder object under uploaded/.
	new s3deploy.BucketDeployment(this, 'UploadedPrefixDeployment', {
	  destinationBucket: this.importBucket,
	  sources: [s3deploy.Source.data('uploaded/.keep', '')],
	  prune: false,
	});

	new cdk.CfnOutput(this, 'ImportBucketName', {
	  value: this.importBucket.bucketName,
	  description: 'S3 bucket name for import files',
	});

	new cdk.CfnOutput(this, 'UploadedPrefix', {
	  value: 'uploaded/',
	  description: 'Prefix used for uploaded files in the import bucket',
	});
  }

}
