import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type ImportEvent = {
  queryStringParameters?: {
    fileName?: string;
  } | null;
};

const s3Client = new S3Client({});
const URL_EXPIRES_IN_SECONDS = 300;

function buildResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    },
    body: JSON.stringify(body),
  };
}

function isValidCsvFileName(fileName: string) {
  return /^[A-Za-z0-9._-]+\.csv$/.test(fileName);
}

export async function main(event: ImportEvent) {
  try {
    const importBucketName = process.env.IMPORT_BUCKET_NAME || '';
    const uploadedPrefix = process.env.UPLOADED_PREFIX || 'uploaded/';
    const fileName = event?.queryStringParameters?.fileName?.trim();

    if (!fileName) {
      return buildResponse(400, { message: 'Query parameter "fileName" is required' });
    }

    if (!isValidCsvFileName(fileName)) {
      return buildResponse(400, {
        message: 'Query parameter "fileName" must be a valid CSV file name',
      });
    }

    if (!importBucketName) {
      console.error('IMPORT_BUCKET_NAME is not configured');
      return buildResponse(500, { message: 'Server configuration error' });
    }

    const key = `${uploadedPrefix}${fileName}`;
    const command = new PutObjectCommand({
      Bucket: importBucketName,
      Key: key,
      ContentType: 'text/csv',
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRES_IN_SECONDS,
    });

    return buildResponse(200, { signedUrl });
  } catch (error) {
    console.error('Error creating signed url:', error);
    return buildResponse(500, { message: 'Error creating signed url' });
  }
}


