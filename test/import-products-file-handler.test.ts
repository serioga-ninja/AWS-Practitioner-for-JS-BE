const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {},
  PutObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

import { main } from '../lib/import-service/import-products-file-handler';

describe('importProductsFile handler', () => {
  beforeEach(() => {
    mockGetSignedUrl.mockReset();
    process.env.IMPORT_BUCKET_NAME = 'test-import-bucket';
    process.env.UPLOADED_PREFIX = 'uploaded/';
  });

  test('returns 400 when fileName query parameter is missing', async () => {
    const response = await main({ queryStringParameters: null });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Query parameter "fileName" is required',
    });
  });

  test('returns 400 when fileName is not csv', async () => {
    const response = await main({
      queryStringParameters: {
        fileName: 'products.json',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Query parameter "fileName" must be a valid CSV file name',
    });
  });

  test('returns signed url when input is valid', async () => {
    mockGetSignedUrl.mockResolvedValueOnce('https://signed-url.example');

    const response = await main({
      queryStringParameters: {
        fileName: 'products.csv',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      signedUrl: 'https://signed-url.example',
    });

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    const command = mockGetSignedUrl.mock.calls[0][1] as { input: { Bucket: string; Key: string } };
    expect(command.input.Bucket).toBe('test-import-bucket');
    expect(command.input.Key).toBe('uploaded/products.csv');
  });

  test('returns 500 when signed url generation fails', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(new Error('sign failure'));

    const response = await main({
      queryStringParameters: {
        fileName: 'products.csv',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Error creating signed url',
    });
  });
});

