import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from './models/product';

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || 'stock';

export async function main(event?: unknown) {
  try {
    console.log('Incoming getProductsList request', { event });

    // Fetch all products
    const productsResult = await docClient.send(
      new ScanCommand({
        TableName: PRODUCTS_TABLE_NAME,
      })
    );

    // Fetch all stock records
    const stockResult = await docClient.send(
      new ScanCommand({
        TableName: STOCK_TABLE_NAME,
      })
    );

    // Create a stock lookup map for quick access
    const stockMap = new Map(
      (stockResult.Items || []).map((item: any) => [item.product_id, item.count])
    );

    // Join products with their stock data
    const products: Product[] = (productsResult.Items || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      count: stockMap.get(item.id) || 0, // Default to 0 if no stock found
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify(products),
    };
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ message: 'Error fetching products' }),
    };
  }
}
