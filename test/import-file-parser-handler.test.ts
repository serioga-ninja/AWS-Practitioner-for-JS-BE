import { Readable } from 'stream';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mockSend;
  },
  GetObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { main } from '../lib/import-service/import-file-parser-handler';

describe('importFileParser handler', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  test('reads csv from s3 and logs each parsed record', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      // suppress noisy test logs
    });

    mockSend.mockResolvedValueOnce({
      Body: Readable.from(['title,price\nBook,10\nPen,2\n']),
    });

    await main({
      Records: [
        {
          s3: {
            bucket: { name: 'import-bucket' },
            object: { key: 'uploaded/products.csv' },
          },
        },
      ],
    } as any);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Parsed CSV record', {
      key: 'uploaded/products.csv',
      record: { title: 'Book', price: '10' },
    });
    expect(logSpy).toHaveBeenCalledWith('Parsed CSV record', {
      key: 'uploaded/products.csv',
      record: { title: 'Pen', price: '2' },
    });

    logSpy.mockRestore();
  });

  test('throws when s3 object body is not readable', async () => {
    mockSend.mockResolvedValueOnce({ Body: undefined });

    await expect(
      main({
        Records: [
          {
            s3: {
              bucket: { name: 'import-bucket' },
              object: { key: 'uploaded/products.csv' },
            },
          },
        ],
      } as any)
    ).rejects.toThrow('Unable to read object body as stream');
  });
});

