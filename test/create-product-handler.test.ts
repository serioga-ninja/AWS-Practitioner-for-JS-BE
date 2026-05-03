const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {},
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({ send: mockSend }),
  },
  TransactWriteCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { main } from '../lib/product-service/create-product-handler';

describe('createProduct handler', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  test('returns 400 when request body is missing', async () => {
    const response = await main({ body: null });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ message: 'Request body is required' });
  });

  test('returns 400 when request body is invalid json', async () => {
    const response = await main({ body: '{invalid-json' });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ message: 'Request body must be valid JSON' });
  });

  test('returns 400 when request payload is invalid', async () => {
    const response = await main({
      body: JSON.stringify({
        title: '',
        description: 'desc',
        price: 100,
      }),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Field "title" is required and must be a non-empty string',
    });
  });

  test('creates product and stock in one transaction', async () => {
    mockSend.mockResolvedValueOnce({});

    const response = await main({
      body: JSON.stringify({
        title: 'Product Title',
        description: 'This product ...',
        price: 200,
        count: 2,
      }),
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.body);
    expect(body.title).toBe('Product Title');
    expect(body.description).toBe('This product ...');
    expect(body.price).toBe(200);
    expect(body.count).toBe(2);
    expect(body.id).toBeDefined();

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0] as { input: { TransactItems: unknown[] } };
    expect(command.input.TransactItems).toHaveLength(2);
  });

  test('returns 500 when transaction fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

    const response = await main({
      body: JSON.stringify({
        title: 'Product Title',
        description: 'This product ...',
        price: 200,
      }),
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ message: 'Error creating product' });
  });
});

