import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import type { S3Event } from 'aws-lambda';
import csv from 'csv-parser';
import { Readable } from 'stream';

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

const CATALOG_ITEMS_QUEUE_URL = process.env.CATALOG_ITEMS_QUEUE_URL || '';

function isReadableStream(body: unknown): body is Readable {
  return body instanceof Readable;
}

async function sendMessageToSqs(record: Record<string, string>) {
  console.log('Sending CSV record to SQS', { record });

  await sqsClient
    .send(
      new SendMessageCommand({
        QueueUrl: CATALOG_ITEMS_QUEUE_URL,
        MessageBody: JSON.stringify(record),
      }),
    )
    .catch((error) => {
      console.error('Error sending message to SQS', { record, error });
    });
}

function parseCsvStream(stream: Readable, key: string) {
  return new Promise<void>((resolve, reject) => {});
}

function getParsedKey(objectKey: string) {
  if (objectKey.startsWith('uploaded/')) {
    return objectKey.replace(/^uploaded\//, 'parsed/');
  }

  return `parsed/${objectKey.split('/').pop() || objectKey}`;
}

function encodeCopySource(bucketName: string, objectKey: string) {
  return `${bucketName}/${objectKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

async function moveObjectToParsed(bucketName: string, objectKey: string) {
  const parsedKey = getParsedKey(objectKey);

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: encodeCopySource(bucketName, objectKey),
      Key: parsedKey,
    }),
  );

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  console.log('Moved file to parsed folder', {
    sourceKey: objectKey,
    destinationKey: parsedKey,
  });
}

export async function main(event: S3Event) {
  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }),
    );

    if (!result.Body || !isReadableStream(result.Body)) {
      throw new Error(`Unable to read object body as stream for key: ${objectKey}`);
    }

    const { resolve, reject, promise } = Promise.withResolvers<void>();

    let sendCount = 0;

    result.Body.pipe(csv())
      .on('data', (record: Record<string, string>) => {
        sendMessageToSqs(record);
        sendCount++;
      })
      .on('error', reject)
      .on('end', async () => {
        console.log(`Successfully sent ${sendCount} records to SQS`);

        await moveObjectToParsed(bucketName, objectKey);

        resolve();
      });

    await promise;
  }
}
