export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
  imageUrl: string;
};

export const mockProducts: Product[] = [
  {
    id: '1',
    title: 'MacBook Pro 14',
    description: 'Apple laptop with M3 chip for frontend and backend development.',
    price: 1999,
    count: 7,
    imageUrl: 'https://example.com/products/macbook-pro-14.jpg',
  },
  {
    id: '2',
    title: 'Dell XPS 13',
    description: 'Compact ultrabook for everyday engineering tasks.',
    price: 1499,
    count: 12,
    imageUrl: 'https://example.com/products/dell-xps-13.jpg',
  },
  {
    id: '3',
    title: 'Lenovo ThinkPad X1 Carbon',
    description: 'Durable business laptop with strong keyboard ergonomics.',
    price: 1699,
    count: 5,
    imageUrl: 'https://example.com/products/thinkpad-x1-carbon.jpg',
  },
  {
    id: '4',
    title: 'ASUS ROG Zephyrus G14',
    description: 'Powerful machine for graphics and high performance workflows.',
    price: 1799,
    count: 4,
    imageUrl: 'https://example.com/products/rog-zephyrus-g14.jpg',
  },
  {
    id: '5',
    title: 'HP Spectre x360',
    description: '2-in-1 laptop with touchscreen and premium build quality.',
    price: 1399,
    count: 9,
    imageUrl: 'https://example.com/products/hp-spectre-x360.jpg',
  },
  {
    id: '6',
    title: 'Acer Swift 3',
    description: 'Affordable and lightweight option for PLP demo data.',
    price: 899,
    count: 15,
    imageUrl: 'https://example.com/products/acer-swift-3.jpg',
  },
];

