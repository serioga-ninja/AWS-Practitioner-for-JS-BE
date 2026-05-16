import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AuthorizationServiceStack } from '../lib/authorization-service/authorization-service-stack';

describe('AuthorizationServiceStack', () => {
  test('creates basicAuthorizer lambda with credentials from environment', () => {
    const previousPassword = process.env.SERIOGA_NINJA;
    process.env.SERIOGA_NINJA = 'TEST_PASSWORD';

    const app = new cdk.App();
    const stack = new AuthorizationServiceStack(app, 'AuthorizationServiceStackTest');
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'basicAuthorizer',
      Handler: 'basic-authorizer-handler.main',
      Runtime: 'nodejs24.x',
      Environment: {
        Variables: Match.objectLike({
          SERIOGA_NINJA: 'TEST_PASSWORD',
        }),
      },
    });

    template.hasOutput('BasicAuthorizerFunctionName', {
      Description: 'Basic authorizer Lambda function name',
      Value: Match.anyValue(),
    });

    if (previousPassword === undefined) {
      delete process.env.SERIOGA_NINJA;
    } else {
      process.env.SERIOGA_NINJA = previousPassword;
    }
  });
});
