import { Readable } from 'stream';

const mockS3Send = jest.fn();
const mockSqsSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mockS3Send;
  },
  GetObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
  CopyObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: class {
    send = mockSqsSend;
  },
  SendMessageCommand: class {
    input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { main } from '../lib/import-service/import-file-parser-handler';

describe('importFileParser handler', () => {
  beforeEach(() => {
    mockS3Send.mockReset();
    mockSqsSend.mockReset();
    process.env.CATALOG_ITEMS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/catalogItemsQueue';
  });

  test('reads csv from s3 and sends each record to SQS', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      // suppress noisy test logs
    });

    mockS3Send.mockResolvedValueOnce({
      Body: Readable.from(['title,price,count\nBook,10,5\nPen,2,10\n']),
    });
    mockSqsSend.mockResolvedValue({});

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

    expect(mockS3Send).toHaveBeenCalledTimes(3); // GetObject, CopyObject, DeleteObject
    expect(mockSqsSend).toHaveBeenCalledTimes(2);

    expect(logSpy).toHaveBeenCalledWith('Sending CSV record to SQS', {
      record: { title: 'Book', price: '10', count: '5' },
    });
    expect(logSpy).toHaveBeenCalledWith('Sending CSV record to SQS', {
      record: { title: 'Pen', price: '2', count: '10' },
    });
    expect(logSpy).toHaveBeenCalledWith('Successfully sent 2 records to SQS');

    logSpy.mockRestore();
  });

  test('throws when s3 object body is not readable', async () => {
    mockS3Send.mockResolvedValueOnce({ Body: undefined });

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

  test('logs error when SQS send fails', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {
      // suppress noisy test logs
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
      // suppress noisy test logs
    });

    mockS3Send.mockResolvedValueOnce({
      Body: Readable.from(['title,price\nBook,10\n']),
    });
    mockSqsSend.mockRejectedValue(new Error('SQS send failed'));

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

    expect(errorSpy).toHaveBeenCalledWith('Error sending message to SQS', expect.objectContaining({
      record: expect.any(Object),
      error: expect.any(Error),
    }));

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
