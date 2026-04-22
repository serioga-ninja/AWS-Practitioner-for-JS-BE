import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const createProductRequestSchema = z.object({
  title: z.string().trim().min(1, 'Field "title" is required and must be a non-empty string'),
  description: z.string().optional(),
  price: z.number().int().positive('Field "price" is required and must be a positive integer'),
});

type CreateProductRequestBody = z.infer<typeof createProductRequestSchema>;

type ProductItem = {
  id: string;
  title: string;
  description: string;
  price: number;
};

type CreateEvent = {
  body: string | null;
};

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';

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

export async function main(event: CreateEvent) {
  if (!event.body) {
    return buildResponse(400, { message: 'Request body is required' });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(event.body);
  } catch {
    return buildResponse(400, { message: 'Request body must be valid JSON' });
  }

  const validationResult = createProductRequestSchema.safeParse(parsedBody);
  if (!validationResult.success) {
    const firstIssue = validationResult.error.issues[0];
    const message = firstIssue?.message || 'Invalid request body';
    return buildResponse(400, { message });
  }

  const validatedBody: CreateProductRequestBody = validationResult.data;

  const item: ProductItem = {
    id: randomUUID(),
    title: validatedBody.title.trim(),
    description: validatedBody.description?.trim() || '',
    price: validatedBody.price,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: PRODUCTS_TABLE_NAME,
        Item: item,
      })
    );

    return buildResponse(201, item);
  } catch (error) {
    console.error('Error creating product:', error);
    return buildResponse(500, { message: 'Error creating product' });
  }
}


