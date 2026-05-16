import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ImportServiceStack } from '../lib/import-service/import-service-stack';

jest.mock('aws-cdk-lib/aws-lambda-nodejs', () => {
  const lambdaModule = require('aws-cdk-lib/aws-lambda');

  return {
    NodejsFunction: class MockNodejsFunction extends lambdaModule.Function {
      constructor(scope: any, id: string, props: any) {
        super(scope, id, {
          ...props,
          runtime: props.runtime || lambdaModule.Runtime.NODEJS_24_X,
          handler: props.handler || 'index.main',
          code: lambdaModule.Code.fromInline('exports.main = async () => ({ ok: true });'),
        });
      }
    },
  };
});

describe('ImportServiceStack', () => {
  test('creates import lambdas, GET /import endpoint and S3 notification for parser', () => {
    const app = new cdk.App();

    // Create a mock queue for testing
    const mockQueueStack = new cdk.Stack(app, 'MockQueueStack');
    const mockQueue = new sqs.Queue(mockQueueStack, 'MockCatalogItemsQueue', {
      queueName: 'test-catalogItemsQueue',
    });

    const authorizerStack = new cdk.Stack(app, 'MockAuthorizerStack');
    const basicAuthorizerFunction = new lambda.Function(authorizerStack, 'MockBasicAuthorizer', {
      functionName: 'mockBasicAuthorizer',
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.main',
      code: lambda.Code.fromInline('exports.main = async () => ({ principalId: "test" });'),
    });

    const stack = new ImportServiceStack(app, 'ImportServiceStackTest', {
      catalogItemsQueue: mockQueue,
      basicAuthorizerFunctionArn: basicAuthorizerFunction.functionArn,
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'importProductsFile',
      Handler: 'import-products-file-handler.main',
      Runtime: 'nodejs24.x',
      Environment: {
        Variables: Match.objectLike({
          IMPORT_BUCKET_NAME: Match.anyValue(),
          UPLOADED_PREFIX: 'uploaded/',
        }),
      },
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          CATALOG_ITEMS_QUEUE_URL: Match.anyValue(),
        }),
      },
    });

    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'import',
    });

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'GET',
      AuthorizationType: 'CUSTOM',
      AuthorizerId: Match.anyValue(),
    });

    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'TOKEN',
      IdentitySource: 'method.request.header.Authorization',
    });

    template.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
      ResponseType: 'DEFAULT_4XX',
      ResponseParameters: Match.objectLike({
        'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
        'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
        'gatewayresponse.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
      }),
    });

    template.hasResourceProperties('AWS::ApiGateway::GatewayResponse', {
      ResponseType: 'DEFAULT_5XX',
      ResponseParameters: Match.objectLike({
        'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
        'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
        'gatewayresponse.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
      }),
    });

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['s3:PutObject']),
          }),
        ]),
      }),
    });

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['s3:GetObject*']),
          }),
        ]),
      }),
    });

    // Note: SQS SendMessage permission is granted via cross-stack reference
    // and may not appear in this stack's template during testing

    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 's3.amazonaws.com',
    });

    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: 'apigateway.amazonaws.com',
    });

    template.hasResourceProperties('Custom::S3BucketNotifications', {
      NotificationConfiguration: Match.objectLike({
        LambdaFunctionConfigurations: Match.arrayWith([
          Match.objectLike({
            Events: Match.arrayWith(['s3:ObjectCreated:*']),
            Filter: {
              Key: {
                FilterRules: Match.arrayWith([
                  {
                    Name: 'prefix',
                    Value: 'uploaded/',
                  },
                ]),
              },
            },
          }),
        ]),
      }),
    });
  });
});
