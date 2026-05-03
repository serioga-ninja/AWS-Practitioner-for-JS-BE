import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { S3Event } from 'aws-lambda';
import csv from 'csv-parser';
import { Readable } from 'stream';

const s3Client = new S3Client({});

function isReadableStream(body: unknown): body is Readable {
  return body instanceof Readable;
}

function parseCsvStream(stream: Readable, key: string) {
  return new Promise<void>((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (record: Record<string, string>) => {
        console.log('Parsed CSV record', { key, record });
      })
      .on('error', reject)
      .on('end', () => resolve());
  });
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
    })
  );

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
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
      })
    );

    if (!result.Body || !isReadableStream(result.Body)) {
      throw new Error(`Unable to read object body as stream for key: ${objectKey}`);
    }

    await parseCsvStream(result.Body, objectKey);
    await moveObjectToParsed(bucketName, objectKey);
  }
}
