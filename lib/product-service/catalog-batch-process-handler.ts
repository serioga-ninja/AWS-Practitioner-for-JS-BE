import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { randomUUID } from 'crypto';

type ProductData = {
  title: string;
  description?: string;
  price: number;
  count?: number;
};

function validateProductData(
  data: unknown,
): { valid: false; error: string } | { valid: true; data: ProductData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Product data must be an object' };
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

  if (
    obj.count !== undefined &&
    (typeof obj.count !== 'number' || !Number.isInteger(obj.count) || obj.count < 0)
  ) {
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

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);
const snsClient = new SNSClient({});

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || 'stock';
const CREATE_PRODUCT_TOPIC_ARN = process.env.CREATE_PRODUCT_TOPIC_ARN || '';

async function createProduct(productData: ProductData): Promise<ProductItem & { count: number }> {
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
    }),
  );

  console.log('Product created successfully', { id, title: productItem.title });

  return {
    ...productItem,
    count: stockItem.count,
  };
}

async function processRecord(record: SQSRecord): Promise<ProductItem & { count: number }> {
  try {
    console.log('Processing SQS record', { messageId: record.messageId });

    const messageBody = JSON.parse(record.body);
    console.log('Message body', { messageBody });

    const validationResult = validateProductData(messageBody);
    if (!validationResult.valid) {
      console.error('Validation error', { error: validationResult.error, messageBody });
      throw new Error(`Validation error: ${validationResult.error}`);
    }

    return await createProduct(validationResult.data);
  } catch (error) {
    console.error('Error processing record', {
      messageId: record.messageId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

async function sendSnsNotification(
  products: Array<ProductItem & { count: number }>,
): Promise<void> {
  try {
    // Calculate aggregated metrics for filtering
    const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
    const averagePrice = Math.round(totalPrice / products.length);
    const maxPrice = Math.max(...products.map((p) => p.price));
    const totalCount = products.reduce((sum, p) => sum + p.count, 0);

    await snsClient.send(
      new PublishCommand({
        TopicArn: CREATE_PRODUCT_TOPIC_ARN,
        Subject: 'Products Created',
        Message: JSON.stringify(
          {
            message: `Successfully created ${products.length} product(s) in the catalog.`,
            products: products.map((p) => ({
              id: p.id,
              title: p.title,
              price: p.price,
              count: p.count,
            })),
            metrics: {
              totalProducts: products.length,
              averagePrice,
              maxPrice,
              totalCount,
            },
          },
          null,
          2,
        ),
        MessageAttributes: {
          productCount: {
            DataType: 'Number',
            StringValue: String(products.length),
          },
          averagePrice: {
            DataType: 'Number',
            StringValue: String(averagePrice),
          },
          maxPrice: {
            DataType: 'Number',
            StringValue: String(maxPrice),
          },
          priceCategory: {
            DataType: 'String',
            StringValue: maxPrice >= 100 ? 'high-value' : 'low-value',
          },
        },
      }),
    );
    console.log('SNS notification sent', { productCount: products.length, averagePrice, maxPrice });
  } catch (error) {
    console.error('Error sending SNS notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - notification failure shouldn't fail the whole process
  }
}

export async function main(event: SQSEvent): Promise<void> {
  console.log('catalogBatchProcess invoked', {
    recordCount: event.Records.length,
  });

  const processPromises = event.Records.map((record) => processRecord(record));

  try {
    const createdProducts = await Promise.all(processPromises);
    console.log('All records processed successfully');

    // Send SNS notification after successful product creation
    await sendSnsNotification(createdProducts);
  } catch (error) {
    console.error('Error processing batch', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Re-throw to trigger SQS retry mechanism
    throw error;
  }
}
