import { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';
import { main } from '../lib/authorization-service/basic-authorizer-handler';

function toBasicToken(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function createAuthorizerEvent(authorizationToken?: string): APIGatewayTokenAuthorizerEvent {
  return {
    type: 'TOKEN',
    authorizationToken: authorizationToken || '',
    methodArn: 'arn:aws:execute-api:eu-central-1:123456789012:restApiId/test/GET/import',
  };
}

function getPolicyEffect(result: APIGatewayAuthorizerResult) {
  return result.policyDocument.Statement[0].Effect;
}

describe('basicAuthorizer handler', () => {
  beforeEach(() => {
    process.env.SERIOGA_NINJA = 'TEST_PASSWORD';
  });

  test('throws Unauthorized when authorization token is not provided', async () => {
    await expect(main(createAuthorizerEvent())).rejects.toThrow('Unauthorized');
  });

  test('returns Deny policy for malformed authorization token', async () => {
    const response = await main(createAuthorizerEvent('Bearer token'));

    expect(getPolicyEffect(response)).toBe('Deny');
  });

  test('returns Deny policy when user password does not match', async () => {
    const response = await main(createAuthorizerEvent(toBasicToken('serioga-ninja', 'WRONG_PASSWORD')));

    expect(getPolicyEffect(response)).toBe('Deny');
  });

  test('returns Allow policy when credentials are valid', async () => {
    const response = await main(createAuthorizerEvent(toBasicToken('serioga-ninja', 'TEST_PASSWORD')));

    expect(getPolicyEffect(response)).toBe('Allow');
    expect(response.principalId).toBe('serioga-ninja');
  });
});
