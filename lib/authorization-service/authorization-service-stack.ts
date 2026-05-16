import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';
import { NODE_VERSION } from '../const';

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.basicAuthorizerFunction = new lambda.Function(this, 'BasicAuthorizerLambda', {
      functionName: 'basicAuthorizer',
      runtime: NODE_VERSION,
      handler: 'basic-authorizer-handler.main',
      code: lambda.Code.fromAsset(path.join(__dirname, './')),
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      environment: {
        USERNAME: process.env.USERNAME || '',
        PASSWORD: process.env.PASSWORD || '',
      },
    });

    new cdk.CfnOutput(this, 'BasicAuthorizerFunctionName', {
      value: this.basicAuthorizerFunction.functionName,
      description: 'Basic authorizer Lambda function name',
    });
  }
}
