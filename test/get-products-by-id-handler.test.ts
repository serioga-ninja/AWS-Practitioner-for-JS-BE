const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {},
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({ send: mockSend }),
  },
  GetCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { main } from '../lib/product-service/get-products-by-id-handler';

describe('getProductsById handler', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  test('returns a product when productId exists', async () => {
    mockSend
      .mockResolvedValueOnce({
        Item: {
          id: '1',
          title: 'Product Title',
          description: 'This product ...',
          price: 200,
        },
      })
      .mockResolvedValueOnce({
        Item: {
          product_id: '1',
          count: 2,
        },
      });

    const response = await main({
      pathParameters: {
        productId: '1',
      },
    });

    expect(response.statusCode).toBe(200);

    const product = JSON.parse(response.body);
    expect(product.id).toBe('1');
    expect(product.title).toBe('Product Title');
    expect(product.count).toBe(2);
  });

  test('returns 404 when product does not exist', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const response = await main({
      pathParameters: {
        productId: 'missing-id',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ message: 'Product not found' });
  });

  test('returns 500 when dynamodb read fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));

    const response = await main({
      pathParameters: {
        productId: '1',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ message: 'Error fetching product' });
  });
});

