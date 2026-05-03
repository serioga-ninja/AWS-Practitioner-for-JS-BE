import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Product } from './models/product';

const dynamoDBClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || 'products';
const STOCK_TABLE_NAME = process.env.STOCK_TABLE_NAME || 'stock';

type PathEvent = {
  pathParameters?: {
    productId?: string;
  };
};

export async function main(event: PathEvent) {
  try {
    console.log('Incoming getProductsById request', { event });

    const productId = event?.pathParameters?.productId;

    if (!productId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({ message: 'productId path parameter is required' }),
      };
    }

    // Fetch product from products table
    const productResult = await docClient.send(
      new GetCommand({
        TableName: PRODUCTS_TABLE_NAME,
        Key: { id: productId },
      })
    );

    if (!productResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    // Fetch stock from stock table
    const stockResult = await docClient.send(
      new GetCommand({
        TableName: STOCK_TABLE_NAME,
        Key: { product_id: productId },
      })
    );

    // Join product and stock data
    const product: Product = {
      id: productResult.Item.id,
      title: productResult.Item.title,
      description: productResult.Item.description,
      price: productResult.Item.price,
      count: stockResult.Item?.count || 0, // Default to 0 if no stock found
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error('Error fetching product:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      },
      body: JSON.stringify({ message: 'Error fetching product' }),
    };
  }
}

