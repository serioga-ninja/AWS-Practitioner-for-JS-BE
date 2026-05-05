import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

type CreateProductRequestBody = {
  title: string;
  description?: string;
  price: number;
  count?: number;
};

function validateCreateProductRequest(data: unknown): { valid: false; error: string } | { valid: true; data: CreateProductRequestBody } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    return { valid: false, error: 'Field "title" is required and must be a non-empty string' };
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return { valid: false, error: 'Field "description" must be a string if provided' };
  }

  if (typeof obj.price !== 'number' || !Number.isInteger(obj.price) || obj.price <= 0) {
    return { valid: false, error: 'Field "price" is required and must be a positive integer' };
  }

  if (obj.count !== undefined && (typeof obj.count !== 'number' || !Number.isInteger(obj.count) || obj.count < 0)) {
    return { valid: false, error: 'Field "count" must be a non-negative integer' };
  }

  return {
    valid: true,
    data: {
      title: obj.title,
      description: obj.description as string | undefined,
      price: obj.price,
      count: obj.count as number | undefined,
    },
  };
}

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

    const validationResult = validateCreateProductRequest(parsedBody);
    if (!validationResult.valid) {
      return buildResponse(400, { message: validationResult.error });
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
