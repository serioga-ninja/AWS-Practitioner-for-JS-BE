/**
 * Product model - represents the joined view of Product and Stock from DynamoDB
 *
 * This model combines data from two separate DynamoDB tables:
 * 1. Products table - contains product metadata (id, title, description, price)
 * 2. Stock table - contains inventory information (product_id, count)
 *
 * The frontend receives this joined model, allowing to enforce stock limits
 * on the UI side (users cannot buy more than product.count items in stock)
 */
export interface Product {
  // From products table
  id: string;
  title: string;
  description: string;
  price: number;

  // From stock table
  count: number;
}

