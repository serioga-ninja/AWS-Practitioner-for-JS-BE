import { mockProducts } from './mock-products';

export async function main() {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    body: JSON.stringify(mockProducts),
  };
}
