import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'ecoexchange-dev-secret';

const SELLER_COMMISSION_RATE = Number(process.env.SELLER_COMMISSION_RATE || 0.02);
const BUYER_COMMISSION_RATE = Number(process.env.BUYER_COMMISSION_RATE || 0.05);
const TRANSPORT_CHARGE = Number(process.env.TRANSPORT_CHARGE || 5000);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

export type Role = 'SELLER' | 'BUYER' | 'ADMIN';
export type OrderType = 'SELL' | 'BUY';
export type OrderStatus =
  | 'LISTED'
  | 'ORDER_PLACED'
  | 'ADMIN_REVIEW'
  | 'FORWARDED_TO_LOGISTICS'
  | 'PICKUP_SCHEDULED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';
export type LogisticsStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED';

interface User {
  id: string;
  industryName: string;
  ownerName: string;
  email: string;
  location: string;
  contactNumber: string;
  passwordHash: string;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

interface WasteListing {
  id: string;
  wasteType: string;
  quantity: number;
  unit: string;
  price: number;
  location: string;
  description: string;
  imageUrl: string | null;
  sellerId: string;
  availability: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Order {
  id: string;
  orderCode: string;
  orderType: OrderType;
  buyerId: string;
  sellerId: string;
  wasteListingId: string | null;
  wasteType: string;
  quantity: number;
  location: string;
  basePrice: number;
  buyerCommission: number;
  sellerCommission: number;
  transportCharge: number;
  finalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

interface LogisticsCompany {
  id: string;
  companyName: string;
  contactNumber: string;
  serviceArea: string;
  status: string;
  createdAt: string;
}

interface LogisticsRequest {
  id: string;
  requestCode: string;
  orderId: string;
  logisticsCompanyId?: string | null;
  pickupLocation: string;
  deliveryLocation: string;
  wasteType: string;
  quantity: number;
  transportCharge: number;
  status: LogisticsStatus;
  createdAt: string;
  updatedAt: string;
}

interface Transaction {
  id: string;
  orderId: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Store {
  users: User[];
  wasteListings: WasteListing[];
  orders: Order[];
  logisticsCompanies: LogisticsCompany[];
  logisticsRequests: LogisticsRequest[];
  transactions: Transaction[];
}

const DATA_PATH = path.resolve(__dirname, '../data/store.json');

const demoUsers: User[] = [
  {
    id: 'user-abc',
    industryName: 'ABC Manufacturing',
    ownerName: 'Rohit Sharma',
    email: 'seller@abc.com',
    location: 'Pune',
    contactNumber: '+91 98765 43210',
    passwordHash: bcrypt.hashSync('Password123', 10),
    roles: ['SELLER', 'BUYER'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-greensteel',
    industryName: 'GreenSteel Industries',
    ownerName: 'Aisha Naidu',
    email: 'buyer@greensteel.com',
    location: 'Mumbai',
    contactNumber: '+91 99887 66554',
    passwordHash: bcrypt.hashSync('Password123', 10),
    roles: ['BUYER', 'SELLER'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'user-ecoplast',
    industryName: 'EcoPlast Solutions',
    ownerName: 'Naveen Iyer',
    email: 'sales@ecoplast.com',
    location: 'Bengaluru',
    contactNumber: '+91 98111 22233',
    passwordHash: bcrypt.hashSync('Password123', 10),
    roles: ['SELLER'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const demoListings: WasteListing[] = [
  {
    id: 'listing-1',
    wasteType: 'Steel Scrap',
    quantity: 1200,
    unit: 'kg',
    price: 95000,
    location: 'Pune',
    description: 'High-grade steel scrap suitable for re-melting and industrial reuse.',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee2279d0d3a8?auto=format&fit=crop&w=900&q=80',
    sellerId: 'user-abc',
    availability: 'Available',
    status: 'LISTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'listing-2',
    wasteType: 'Plastic Scrap',
    quantity: 900,
    unit: 'kg',
    price: 62000,
    location: 'Bengaluru',
    description: 'Clean HDPE and LDPE polymer waste sorted by grade.',
    imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=900&q=80',
    sellerId: 'user-ecoplast',
    availability: 'Available',
    status: 'LISTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'listing-3',
    wasteType: 'Fly Ash',
    quantity: 5,
    unit: 'tonnes',
    price: 150000,
    location: 'Nagpur',
    description: 'Ash by-product with consistent density for construction and filler use.',
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80',
    sellerId: 'user-abc',
    availability: 'Available',
    status: 'LISTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const demoLogisticsCompanies: LogisticsCompany[] = [
  {
    id: 'logistics-1',
    companyName: 'ABC Logistics',
    contactNumber: '+91 90123 45678',
    serviceArea: 'Pune, Mumbai',
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'logistics-2',
    companyName: 'GreenMove Transport',
    contactNumber: '+91 91234 56789',
    serviceArea: 'Bengaluru, Chennai',
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'logistics-3',
    companyName: 'EcoCargo',
    contactNumber: '+91 92345 67890',
    serviceArea: 'Hyderabad, Nagpur',
    status: 'Active',
    createdAt: new Date().toISOString(),
  },
];

const defaultStore: Store = {
  users: demoUsers,
  wasteListings: demoListings,
  orders: [],
  logisticsCompanies: demoLogisticsCompanies,
  logisticsRequests: [],
  transactions: [],
};

function ensureStoreFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultStore, null, 2), 'utf-8');
  }
}

function normalizeDemoCredentials(store: Store) {
  const demoCredentialMap: Record<string, string> = {
    'seller@abc.com': 'Password123',
    'buyer@greensteel.com': 'Password123',
    'sales@ecoplast.com': 'Password123',
  };

  let changed = false;
  for (const user of store.users) {
    const password = demoCredentialMap[user.email?.toLowerCase() ?? ''];
    if (!password) continue;
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      user.passwordHash = bcrypt.hashSync(password, 10);
      changed = true;
    }
  }

  if (changed) {
    saveStore(store);
  }

  return store;
}

function readStore(): Store {
  ensureStoreFile();
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  if (!raw.trim()) return defaultStore;
  try {
    const parsed = JSON.parse(raw) as Store;
    return normalizeDemoCredentials(parsed);
  } catch {
    return normalizeDemoCredentials(defaultStore);
  }
}

function saveStore(store: Store) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function sanitizeUser(user: User) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function signToken(user: User) {
  return jwt.sign({ id: user.id, email: user.email, roles: user.roles }, JWT_SECRET, { expiresIn: '7d' });
}

function getAdminUser(): User {
  return {
    id: 'admin-demo',
    industryName: 'EcoExchange Admin',
    ownerName: 'Platform Admin',
    email: process.env.ADMIN_IDENTIFIER || '/*$/eco555',
    location: 'Head Office',
    contactNumber: '+91 90000 00000',
    passwordHash: '',
    roles: ['ADMIN'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; roles: Role[] };
    if (payload.id === 'admin-demo' && payload.roles?.includes('ADMIN')) {
      return getAdminUser();
    }
    const store = readStore();
    return store.users.find((user) => user.id === payload.id) || null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  (req as Request & { user?: User }).user = user;
  return next();
}

function requireRole(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as Request & { user?: User }).user;
    if (!user || !user.roles.some((role) => roles.includes(role))) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    return next();
  };
}

function createOrderCode(store: Store) {
  return `ECO-BUY-${String(store.orders.length + 1).padStart(6, '0')}`;
}

function createListingCode(store: Store) {
  return `ECO-SELL-${String(store.wasteListings.length + 1).padStart(6, '0')}`;
}

function createRequestCode(store: Store) {
  return `ECO-LOG-${String(store.logisticsRequests.length + 1).padStart(6, '0')}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'EcoExchange' });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { industryName, ownerName, email, location, contactNumber, password, confirmPassword } = req.body || {};

  if (!industryName || !ownerName || !email || !location || !contactNumber || !password || !confirmPassword) {
    return res.status(400).json({ message: 'Please complete all required fields.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match.' });
  }

  const store = readStore();
  if (store.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const newUser: User = {
    id: randomUUID(),
    industryName,
    ownerName,
    email: email.toLowerCase(),
    location,
    contactNumber,
    passwordHash: await bcrypt.hash(password, 10),
    roles: ['SELLER', 'BUYER'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.users.push(newUser);
  saveStore(store);

  const token = signToken(newUser);
  return res.status(201).json({ message: 'Registration successful. Welcome to EcoExchange.', token, user: sanitizeUser(newUser) });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  const adminIdentifier = process.env.ADMIN_IDENTIFIER || '/*$/eco555';
  const adminPassword = process.env.ADMIN_PASSWORD || 'eco555';

  if (email === adminIdentifier && password === adminPassword) {
    const adminUser: User = {
      id: 'admin-demo',
      industryName: 'EcoExchange Admin',
      ownerName: 'Platform Admin',
      email: adminIdentifier,
      location: 'Head Office',
      contactNumber: '+91 90000 00000',
      passwordHash: await bcrypt.hash(adminPassword, 10),
      roles: ['ADMIN'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const token = signToken(adminUser);
    return res.json({ message: 'Login successful.', token, user: sanitizeUser(adminUser) });
  }

  const store = readStore();
  const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });

  const isValid = await bcrypt.compare(String(password || ''), user.passwordHash);
  if (!isValid) return res.status(401).json({ message: 'Invalid email or password.' });

  const token = signToken(user);
  return res.json({ message: 'Login successful.', token, user: sanitizeUser(user) });
});

app.get('/api/users/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: User }).user;
  if (!user) return res.status(401).json({ message: 'Authentication required.' });
  return res.json({ user: sanitizeUser(user) });
});

app.put('/api/users/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: User }).user;
  if (!user) return res.status(401).json({ message: 'Authentication required.' });

  const store = readStore();
  const index = store.users.findIndex((entry) => entry.id === user.id);
  if (index < 0) return res.status(404).json({ message: 'User not found.' });

  const updates = req.body || {};
  store.users[index] = {
    ...store.users[index],
    industryName: updates.industryName || store.users[index].industryName,
    ownerName: updates.ownerName || store.users[index].ownerName,
    location: updates.location || store.users[index].location,
    contactNumber: updates.contactNumber || store.users[index].contactNumber,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);

  return res.json({ user: sanitizeUser(store.users[index]) });
});

app.get('/api/waste', (_req, res) => {
  const store = readStore();
  const listings = store.wasteListings.map((listing) => {
    const seller = store.users.find((user) => user.id === listing.sellerId);
    return { ...listing, seller: seller ? sanitizeUser(seller) : null };
  });
  return res.json({ listings });
});

app.get('/api/waste/:id', (req, res) => {
  const store = readStore();
  const listing = store.wasteListings.find((entry) => entry.id === req.params.id);
  if (!listing) return res.status(404).json({ message: 'Waste listing not found.' });
  const seller = store.users.find((user) => user.id === listing.sellerId);
  return res.json({ listing: { ...listing, seller: seller ? sanitizeUser(seller) : null } });
});

app.post('/api/waste', requireAuth, requireRole(['SELLER']), (req: Request, res: Response) => {
  const user = (req as Request & { user?: User }).user;
  if (!user) return res.status(401).json({ message: 'Authentication required.' });

  const { wasteType, quantity, unit, price, location, description, imageUrl } = req.body || {};
  if (!wasteType || !quantity || !unit || !price || !location || !description) {
    return res.status(400).json({ message: 'Please complete all required listing fields.' });
  }

  const store = readStore();
  const listing: WasteListing = {
    id: randomUUID(),
    wasteType,
    quantity: Number(quantity),
    unit,
    price: Number(price),
    location,
    description,
    imageUrl: imageUrl || null,
    sellerId: user.id,
    availability: 'Available',
    status: 'LISTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.wasteListings.unshift(listing);
  saveStore(store);

  return res.status(201).json({ message: 'Waste listing created successfully.', listing });
});

app.post('/api/orders', requireAuth, requireRole(['BUYER']), (req: Request, res: Response) => {
  const user = (req as Request & { user?: User }).user;
  if (!user) return res.status(401).json({ message: 'Authentication required.' });

  const { listingId } = req.body || {};
  if (!listingId) return res.status(400).json({ message: 'Listing is required.' });

  const store = readStore();
  const listing = store.wasteListings.find((entry) => entry.id === listingId);
  if (!listing) return res.status(404).json({ message: 'Listing not found.' });

  const basePrice = Number(listing.price);
  const buyerCommission = basePrice * BUYER_COMMISSION_RATE;
  const transportCharge = TRANSPORT_CHARGE;
  const finalAmount = basePrice + buyerCommission + transportCharge;

  const seller = store.users.find((entry) => entry.id === listing.sellerId);
  if (!seller) return res.status(404).json({ message: 'Seller not found.' });

  const order: Order = {
    id: randomUUID(),
    orderCode: `ECO-BUY-${String(store.orders.length + 1).padStart(6, '0')}`,
    orderType: 'BUY',
    buyerId: user.id,
    sellerId: seller.id,
    wasteListingId: listing.id,
    wasteType: listing.wasteType,
    quantity: listing.quantity,
    location: listing.location,
    basePrice,
    buyerCommission,
    sellerCommission: basePrice * SELLER_COMMISSION_RATE,
    transportCharge,
    finalAmount,
    status: 'ORDER_PLACED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const transaction: Transaction = {
    id: randomUUID(),
    orderId: order.id,
    type: 'BUY',
    amount: finalAmount,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  store.orders.unshift(order);
  store.transactions.push(transaction);
  listing.status = 'ORDERED';
  saveStore(store);

  return res.status(201).json({ message: 'Order placed successfully.', order, transaction });
});

app.get('/api/orders', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: User }).user;
  if (!user) return res.status(401).json({ message: 'Authentication required.' });

  const store = readStore();
  const orders = store.orders.filter((order) => order.buyerId === user.id || order.sellerId === user.id);
  return res.json({ orders });
});

app.put('/api/orders/:id/status', requireAuth, (req: Request, res: Response) => {
  const { status } = req.body || {};
  const store = readStore();
  const order = store.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  order.status = status;
  order.updatedAt = new Date().toISOString();
  saveStore(store);

  return res.json({ message: 'Order status updated.', order });
});

app.get('/api/admin/overview', requireAuth, requireRole(['ADMIN']), (_req, res) => {
  const store = readStore();
  const overview = {
    totalIndustries: store.users.length,
    totalSellers: store.users.filter((entry) => entry.roles.includes('SELLER')).length,
    totalBuyers: store.users.filter((entry) => entry.roles.includes('BUYER')).length,
    totalWasteListings: store.wasteListings.length,
    totalOrders: store.orders.length,
    pendingOrders: store.orders.filter((order) => ['ORDER_PLACED', 'ADMIN_REVIEW'].includes(order.status)).length,
    forwardedOrders: store.orders.filter((order) => order.status === 'FORWARDED_TO_LOGISTICS').length,
    completedOrders: store.orders.filter((order) => order.status === 'COMPLETED').length,
  };

  return res.json({ overview });
});

app.get('/api/admin/orders', requireAuth, requireRole(['ADMIN']), (_req, res) => {
  const store = readStore();
  const orders = store.orders.map((order) => {
    const buyer = store.users.find((user) => user.id === order.buyerId);
    const seller = store.users.find((user) => user.id === order.sellerId);
    return { ...order, buyer: buyer ? sanitizeUser(buyer) : null, seller: seller ? sanitizeUser(seller) : null };
  });
  return res.json({ orders });
});

app.get('/api/admin/users', requireAuth, requireRole(['ADMIN']), (_req, res) => {
  const store = readStore();
  return res.json({ users: store.users.map((user) => sanitizeUser(user)) });
});

app.get('/api/admin/listings', requireAuth, requireRole(['ADMIN']), (_req, res) => {
  const store = readStore();
  return res.json({ listings: store.wasteListings });
});

app.post('/api/admin/orders/:id/forward-logistics', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { logisticsCompanyId } = req.body || {};
  const store = readStore();
  const order = store.orders.find((entry) => entry.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  const company = store.logisticsCompanies.find((entry) => entry.id === logisticsCompanyId);
  if (!company) return res.status(404).json({ message: 'Logistics company not found.' });

  const request: LogisticsRequest = {
    id: randomUUID(),
    requestCode: `ECO-LOG-${String(store.logisticsRequests.length + 1).padStart(6, '0')}`,
    orderId: order.id,
    logisticsCompanyId: company.id,
    pickupLocation: order.location,
    deliveryLocation: 'Warehouse Center',
    wasteType: order.wasteType,
    quantity: order.quantity,
    transportCharge: order.transportCharge,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  order.status = 'FORWARDED_TO_LOGISTICS';
  order.updatedAt = new Date().toISOString();
  store.logisticsRequests.push(request);
  saveStore(store);

  return res.json({ message: 'Order successfully forwarded to logistics.', request });
});

app.get('/api/admin/logistics', requireAuth, requireRole(['ADMIN']), (_req, res) => {
  const store = readStore();
  const requests = store.logisticsRequests.map((request) => {
    const order = store.orders.find((entry) => entry.id === request.orderId);
    const company = store.logisticsCompanies.find((entry) => entry.id === request.logisticsCompanyId);
    return { ...request, order, company };
  });
  return res.json({ logisticsRequests: requests, logisticsCompanies: store.logisticsCompanies });
});

app.post('/api/admin/logistics/assign', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { requestId, logisticsCompanyId } = req.body || {};
  const store = readStore();
  const request = store.logisticsRequests.find((entry) => entry.id === requestId);
  if (!request) return res.status(404).json({ message: 'Logistics request not found.' });

  const company = store.logisticsCompanies.find((entry) => entry.id === logisticsCompanyId);
  if (!company) return res.status(404).json({ message: 'Logistics company not found.' });

  request.logisticsCompanyId = company.id;
  request.status = 'ASSIGNED';
  request.updatedAt = new Date().toISOString();
  saveStore(store);

  return res.json({ message: 'Logistics company assigned.', request });
});

app.put('/api/admin/logistics/:id/status', requireAuth, requireRole(['ADMIN']), (req: Request, res: Response) => {
  const { status } = req.body || {};
  const store = readStore();
  const request = store.logisticsRequests.find((entry) => entry.id === req.params.id);
  if (!request) return res.status(404).json({ message: 'Logistics request not found.' });

  request.status = status;
  request.updatedAt = new Date().toISOString();
  saveStore(store);

  return res.json({ message: 'Logistics status updated.', request });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  return res.status(500).json({ message: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`EcoExchange server running on http://localhost:${PORT}`);
});
