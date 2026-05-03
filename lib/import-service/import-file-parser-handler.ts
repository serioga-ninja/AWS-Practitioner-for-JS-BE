import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { S3Event } from 'aws-lambda';
import * as csv from 'csv-parser';
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
  }
}

