import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const createProductRequestSchema = z.object({
  title: z.string().trim().min(1, 'Field "title" is required and must be a non-empty string'),
  description: z.string().optional(),
  price: z.number().int().positive('Field "price" is required and must be a positive integer'),
  count: z.number().int().min(0, 'Field "count" must be a non-negative integer').optional(),
});

type CreateProductRequestBody = z.infer<typeof createProductRequestSchema>;

type ProductItem = {
  id: string;
  title: string;
  description: string;
  price: number;
};

type StockItem = {
  product_id: string;
  count: number;
};

type CreateEvent = {
  body: string | null;
};

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || 'stock';

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
  try {
    console.log('Incoming createProduct request', { event });

    if (!event?.body) {
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
    const id = randomUUID();

    const productItem: ProductItem = {
      id,
      title: validatedBody.title.trim(),
      description: validatedBody.description?.trim() || '',
      price: validatedBody.price,
    };

    const stockItem: StockItem = {
      product_id: id,
      count: validatedBody.count ?? 0,
    };

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: PRODUCTS_TABLE_NAME,
              Item: productItem,
            },
          },
          {
            Put: {
              TableName: STOCK_TABLE_NAME,
              Item: stockItem,
            },
          },
        ],
      })
    );

    return buildResponse(201, {
      ...productItem,
      count: stockItem.count,
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return buildResponse(500, { message: 'Error creating product' });
  }
}


