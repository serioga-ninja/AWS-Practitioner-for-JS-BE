import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const productSchema = z.object({
  title: z.string().trim().min(1, 'Field "title" is required and must be a non-empty string'),
  description: z.string().optional(),
  price: z.number().int().positive('Field "price" is required and must be a positive integer'),
  count: z.number().int().min(0, 'Field "count" must be a non-negative integer').optional(),
});

type ProductData = z.infer<typeof productSchema>;

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

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || 'stock';

async function createProduct(productData: ProductData): Promise<void> {
  const id = randomUUID();

  const productItem: ProductItem = {
    id,
    title: productData.title.trim(),
    description: productData.description?.trim() || '',
    price: productData.price,
  };

  const stockItem: StockItem = {
    product_id: id,
    count: productData.count ?? 0,
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

  console.log('Product created successfully', { id, title: productItem.title });
}

async function processRecord(record: SQSRecord): Promise<void> {
  try {
    console.log('Processing SQS record', { messageId: record.messageId });

    const messageBody = JSON.parse(record.body);
    console.log('Message body', { messageBody });

    const validationResult = productSchema.safeParse(messageBody);
    if (!validationResult.success) {
      const firstIssue = validationResult.error.issues[0];
      const message = firstIssue?.message || 'Invalid product data';
      console.error('Validation error', { message, messageBody });
      throw new Error(`Validation error: ${message}`);
    }

    await createProduct(validationResult.data);
  } catch (error) {
    console.error('Error processing record', {
      messageId: record.messageId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export async function main(event: SQSEvent): Promise<void> {
  console.log('catalogBatchProcess invoked', {
    recordCount: event.Records.length
  });

  const processPromises = event.Records.map((record) => processRecord(record));

  try {
    await Promise.all(processPromises);
    console.log('All records processed successfully');
  } catch (error) {
    console.error('Error processing batch', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Re-throw to trigger SQS retry mechanism
    throw error;
  }
}
