import { main } from '../lib/product-service/get-products-by-id-handler';

describe('getProductsById handler', () => {
  test('returns a product when productId exists', async () => {
    const response = await main({
      pathParameters: {
        productId: '1',
      },
    });

    expect(response.statusCode).toBe(200);

    const product = JSON.parse(response.body);
    expect(product.id).toBe('1');
    expect(product.title).toBe('MacBook Pro 14');
  });

  test('returns 404 when product does not exist', async () => {
    const response = await main({
      pathParameters: {
        productId: 'missing-id',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ message: 'Product not found' });
  });
});

