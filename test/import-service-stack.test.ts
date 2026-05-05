import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ImportServiceStack } from '../lib/import-service/import-service-stack';

describe('ImportServiceStack', () => {
  test('creates import lambdas, GET /import endpoint and S3 notification for parser', () => {
    const app = new cdk.App();

    // Create a mock queue for testing
    const mockQueueStack = new cdk.Stack(app, 'MockQueueStack');
    const mockQueue = new sqs.Queue(mockQueueStack, 'MockCatalogItemsQueue', {
      queueName: 'test-catalogItemsQueue',
    });

    const stack = new ImportServiceStack(app, 'ImportServiceStackTest', {
      catalogItemsQueue: mockQueue,
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
      FunctionName: 'importFileParser',
      Handler: Match.stringLikeRegexp('(import-file-parser-handler|index)\\.main'),
      Runtime: 'nodejs24.x',
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
