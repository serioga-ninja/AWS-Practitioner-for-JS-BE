import { APIGatewayAuthorizerResult, APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

function buildPolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

function parseBasicCredentials(
  authorizationToken: string,
): { username: string; password: string } | null {
  const match = authorizationToken.match(/^Basic\s+(.+)$/i);

  if (!match) {
    return null;
  }

  let decodedCredentials = '';

  try {
    decodedCredentials = Buffer.from(match[1], 'base64').toString('utf-8');
  } catch {
    return null;
  }

  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex <= 0 || separatorIndex >= decodedCredentials.length - 1) {
    return null;
  }

  const username = decodedCredentials.slice(0, separatorIndex).trim();
  const password = decodedCredentials.slice(separatorIndex + 1).trim();

  if (!username || !password) {
    return null;
  }

  return {
    username,
    password,
  };
}

function getExpectedPassword() {
  if (!process.env.PASSWORD) {
    throw new Error('Unauthorized');
  }

  return process.env.PASSWORD;
}

export async function main(
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  if (!event.authorizationToken) {
    throw new Error('Unauthorized');
  }

  const credentials = parseBasicCredentials(event.authorizationToken);

  if (!credentials) {
    return buildPolicy('anonymous', 'Deny', event.methodArn);
  }

  const expectedPassword = getExpectedPassword();

  if (expectedPassword !== credentials.password || credentials.username !== process.env.USERNAME) {
    return buildPolicy(credentials.username, 'Deny', event.methodArn);
  }

  return buildPolicy(credentials.username, 'Allow', event.methodArn);
}
