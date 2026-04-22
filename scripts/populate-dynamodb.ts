import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

// Initialize DynamoDB client with proper configuration
const region = process.env.AWS_REGION || 'eu-central-1';
console.log(`Using AWS Region: ${region}`);

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
}

interface Stock {
  product_id: string;
  count: number;
}

// Sample products data
const sampleProducts: Product[] = [
  {
    id: uuidv4(),
    title: 'Laptop',
    description: 'High-performance laptop for professionals',
    price: 1299,
  },
  {
    id: uuidv4(),
    title: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with long battery life',
    price: 29,
  },
  {
    id: uuidv4(),
    title: 'USB-C Hub',
    description: '7-in-1 USB-C hub with HDMI and SD card reader',
    price: 49,
  },
  {
    id: uuidv4(),
    title: 'Monitor',
    description: '4K UHD monitor with HDR support',
    price: 599,
  },
  {
    id: uuidv4(),
    title: 'Keyboard',
    description: 'Mechanical keyboard with RGB backlight',
    price: 149,
  },
  {
    id: uuidv4(),
    title: 'Webcam',
    description: '4K USB webcam with auto-focus',
    price: 99,
  },
  {
    id: uuidv4(),
    title: 'Headphones',
    description: 'Noise-cancelling wireless headphones',
    price: 199,
  },
  {
    id: uuidv4(),
    title: 'External SSD 1TB',
    description: 'Fast external SSD with USB 3.1 Type-C',
    price: 129,
  },
  {
    id: uuidv4(),
    title: 'Desk Lamp',
    description: 'LED desk lamp with adjustable brightness',
    price: 39,
  },
  {
    id: uuidv4(),
    title: 'Laptop Stand',
    description: 'Adjustable aluminum laptop stand',
    price: 49,
  },
  {
    id: uuidv4(),
    title: 'USB-A Hub',
    description: '4-port USB 3.0 hub with power adapter',
    price: 34,
  },
  {
    id: uuidv4(),
    title: 'HDMI Cable',
    description: '6ft HDMI 2.1 cable',
    price: 19,
  },
  {
    id: uuidv4(),
    title: 'USB-C Cable',
    description: '3-pack USB-C charging cables',
    price: 24,
  },
  {
    id: uuidv4(),
    title: 'Power Bank',
    description: '20000mAh portable power bank with fast charging',
    price: 59,
  },
  {
    id: uuidv4(),
    title: 'Phone Stand',
    description: 'Adjustable metal phone stand',
    price: 14,
  },
  {
    id: uuidv4(),
    title: 'Wireless Charger',
    description: '15W fast wireless charging pad',
    price: 34,
  },
  {
    id: uuidv4(),
    title: 'Monitor Arm',
    description: 'Single monitor adjustable mount arm',
    price: 79,
  },
  {
    id: uuidv4(),
    title: 'Cooling Pad',
    description: 'Laptop cooling pad with dual fans',
    price: 44,
  },
  {
    id: uuidv4(),
    title: 'Cable Organizer',
    description: 'Desktop cable management kit',
    price: 19,
  },
  {
    id: uuidv4(),
    title: 'Screen Protector',
    description: 'Anti-glare screen protector for monitors',
    price: 29,
  },
  {
    id: uuidv4(),
    title: 'Portable Speaker',
    description: 'Bluetooth portable speaker with 12-hour battery',
    price: 49,
  },
  {
    id: uuidv4(),
    title: 'Air Purifier',
    description: 'Small desktop air purifier with HEPA filter',
    price: 89,
  },
  {
    id: uuidv4(),
    title: 'Desk Organizer',
    description: 'Multi-compartment desk organizer',
    price: 29,
  },
  {
    id: uuidv4(),
    title: 'Ergonomic Wrist Rest',
    description: 'Memory foam wrist rest for keyboard',
    price: 19,
  },
  {
    id: uuidv4(),
    title: 'Document Camera',
    description: '8MP HD document scanner camera',
    price: 159,
  },
];

// Sample stock data (will be paired with products)
const generateStockData = (products: Product[]): Stock[] => {
  return products.map((product) => ({
    product_id: product.id,
    count: Math.floor(Math.random() * 100) + 1, // Random stock between 1-100
  }));
};

async function populateDatabase() {
  try {
    console.log('Starting DynamoDB population...');

    // Insert products
    console.log('\nInserting products...');
    for (const product of sampleProducts) {
      await docClient.send(
        new PutCommand({
          TableName: 'products',
          Item: product,
        })
      );
      console.log(`✓ Inserted product: ${product.title} (ID: ${product.id})`);
    }

    // Insert stock records
    console.log('\nInserting stock records...');
    const stockData = generateStockData(sampleProducts);
    for (const stock of stockData) {
      await docClient.send(
        new PutCommand({
          TableName: 'stock',
          Item: stock,
        })
      );
      const product = sampleProducts.find((p) => p.id === stock.product_id);
      console.log(`✓ Inserted stock for ${product?.title}: ${stock.count} units`);
    }

    console.log('\n✅ Database population completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating database:', error);
    process.exit(1);
  }
}

populateDatabase();


