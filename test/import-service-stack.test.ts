import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ImportServiceStack } from '../lib/import-service/import-service-stack';

describe('ImportServiceStack', () => {
  test('creates importProductsFile lambda and GET /import endpoint', () => {
    const app = new cdk.App();
    const stack = new ImportServiceStack(app, 'ImportServiceStackTest');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'importProductsFile',
      Handler: 'import-products-file-handler.main',
      Runtime: 'nodejs20.x',
      Environment: {
        Variables: Match.objectLike({
          IMPORT_BUCKET_NAME: Match.anyValue(),
          UPLOADED_PREFIX: 'uploaded/',
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
  });
});



