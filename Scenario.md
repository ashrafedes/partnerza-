# Partnerza Web Application - Scenario File

## Issue Encountered

### Firebase Configuration Error
**Error**: `Firebase: Error (auth/configuration-not-found)` during registration

**Cause**: The backend `.env` file had placeholder values for Firebase credentials instead of actual service account credentials.

## Solution

### Step 1: Update Backend Firebase Configuration
Updated `backend/.env` file with correct Firebase project ID:
- Changed `FIREBASE_PROJECT_ID=your_firebase_project_id` to `FIREBASE_PROJECT_ID=partnerza`
- Changed `FIREBASE_CLIENT_EMAIL` to include the correct project ID

### Step 2: Frontend Firebase Configuration
Updated `frontend/src/firebase.js` with actual Firebase configuration:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDhofDHaUFJPiFY2jOzkG9Jfs2chOUFqAA",
  authDomain: "partnerza.firebaseapp.com",
  projectId: "partnerza",
  storageBucket: "partnerza.firebasestorage.app",
  messagingSenderId: "904830444554",
  appId: "1:904830444554:web:44187bddae99e3889debf3",
  measurementId: "G-6C4LZZKH6P"
};
```

## Payment Calculation on Order Delivery

### Trigger
When supplier changes order status to `delivered`, the following payment calculations must be executed:

### Required Calculations

#### 1. Platform Commission Calculation
```
Platform Commission = Order Total × Platform Fee Rate
```
- **Platform Fee Rate Source Priority**:
  1. Product-level override (`product.platform_fee_rate_override`)
  2. Marketer-level override (`marketer.platform_fee_rate_override`)
  3. Global default (`platform_settings.default_platform_fee_rate` = 5%)
- **Save to**: Update order `total_platform_fee` field

#### 2. Marketer Commission Calculation
```
Marketer Commission per Item = Item Total × Product Commission Rate
Total Marketer Commission = SUM(all item commissions)
```
- **Commission Rate Source**: From product (`product.marketer_commission_rate`)
- **Item Total** = Unit Price × Quantity
- **Save to**: Update order `total_commission` field
- **Also create**: Commission records in `commissions` table (status: 'pending')

#### 3. Total Commission Pending Calculation
```
Total Pending Commission = SUM of all 'pending' commissions for this marketer
```
- Query `commissions` table where `marketer_id = ? AND status = 'pending'`
- Display in marketer dashboard

### Additional Calculations to Save

| Calculation | Formula | Purpose |
|-------------|---------|---------|
| **Supplier Revenue** | Order Total - Platform Fee - Marketer Commission | What supplier receives |
| **Net Platform Profit** | Platform Fee - Any discounts | Platform's actual earnings |
| **Order Profit Margin** | (Order Total - Costs) / Order Total × 100 | Business metric |
| **Marketer Earnings Rate** | Commission / Order Total × 100 | % of order as commission |
| **Transportation Cost** | Set by supplier per order | Shipping/delivery fees |

### Database Updates Required

When status changes to `delivered`:

1. **Update `orders` table**:
   ```sql
   UPDATE orders SET 
     total_platform_fee = ?,
     total_commission = ?,
     status = 'delivered',
     updated_at = datetime('now')
   WHERE id = ?
   ```

2. **Insert `commissions` records** (one per order item):
   ```sql
   INSERT INTO commissions (order_id, order_item_id, product_id, marketer_id, amount, status)
   VALUES (?, ?, ?, ?, ?, 'pending')
   ```

3. **Update marketer balance** (optional - or wait for approval):
   ```sql
   UPDATE users SET 
     balance = balance + ?
   WHERE id = ?
   ```

### Status Flow for Commissions

```
pending → approved → paid
   ↓
rejected (with note)
```

- `pending`: Order delivered, awaiting admin approval
- `approved`: Admin approved, ready for payout
- `paid`: Withdrawal completed
- `rejected`: Invalid/disputed order

### API Endpoint Required

```
PATCH /api/orders/:id/status
Body: { status: 'delivered' }
```

**Actions performed**:
1. Validate supplier owns the order
2. Update order status
3. Calculate all commissions
4. Create commission records
5. Update order totals
6. Return updated order with calculations

### Business Rules

1. **Commission is earned on delivery**, not on order creation
2. **Platform fee is collected immediately** upon delivery
3. **Marketer commission goes to 'pending'** first, then 'approved' by admin
4. **Withdrawals only allowed** when balance >= `min_withdrawal_amount` (default 100 SAR)
5. **Commission rates are locked** at order creation time (no changes after)

---

## Pending Payments to Platform Guide

### Overview
This guide explains how to view and manage all pending commissions owed to the platform by suppliers, and track payments that have been released.

### Types of Pending Payments

#### 1. Platform Fee Commissions (Pending Collection)
These are platform fees calculated on delivered orders but not yet settled by suppliers.

**Query to View:**
```sql
SELECT 
  o.id as order_id,
  o.supplier_id,
  u.name as supplier_name,
  o.total_amount,
  o.total_platform_fee,
  o.status,
  o.created_at,
  o.updated_at
FROM orders o
JOIN users u ON o.supplier_id = u.id
WHERE o.status = 'delivered' 
  AND o.total_platform_fee > 0
ORDER BY o.updated_at DESC
```

**Displayed Fields:**
| Field | Description |
|-------|-------------|
| Order ID | Unique order identifier |
| Supplier Name | Name of the supplier |
| Order Total | Total order amount (SAR) |
| Platform Fee | Fee owed to platform (SAR) |
| Delivery Date | When order was marked delivered |
| Status | Payment status (pending/settled) |

#### 2. Marketer Commissions (Pending Release)
These are commissions earned by marketers that are awaiting admin approval before payout.

**Query to View All Pending Commissions:**
```sql
SELECT 
  c.id as commission_id,
  c.order_id,
  p.name as product_name,
  m.name as marketer_name,
  c.amount,
  c.status,
  c.created_at,
  s.name as supplier_name
FROM commissions c
JOIN users m ON c.marketer_id = m.id
JOIN products p ON c.product_id = p.id
JOIN orders o ON c.order_id = o.id
JOIN users s ON o.supplier_id = s.id
WHERE c.status = 'pending'
ORDER BY c.created_at DESC
```

**Summary by Supplier:**
```sql
SELECT 
  u.name as supplier_name,
  COUNT(DISTINCT o.id) as total_orders,
  SUM(o.total_platform_fee) as total_platform_fees,
  SUM(o.total_commission) as total_marketer_commissions,
  (SUM(o.total_platform_fee) + SUM(o.total_commission)) as total_amount_due
FROM orders o
JOIN users u ON o.supplier_id = u.id
WHERE o.status = 'delivered'
GROUP BY o.supplier_id
ORDER BY total_amount_due DESC
```

### Admin Dashboard View

#### Pending Collections Summary Card
```
┌─────────────────────────────────────────┐
│  PENDING PLATFORM PAYMENTS              │
├─────────────────────────────────────────┤
│  Total Suppliers:     15                │
│  Total Orders:        127               │
│  Total Platform Fees: 12,450 SAR      │
│  Total Marketer Comm: 24,890 SAR      │
│  ─────────────────────────────────────  │
│  GRAND TOTAL DUE:     37,340 SAR       │
└─────────────────────────────────────────┘
```

#### Detailed Table Columns
| Column | Description |
|--------|-------------|
| Supplier | Supplier company/name |
| Orders Count | Number of delivered orders |
| Platform Fees | Total platform commission due |
| Marketer Fees | Total marketer commission due |
| Total Due | Combined amount supplier owes |
| Last Order | Date of most recent order |
| Action | Mark as settled / View details |

### API Endpoints for Pending Payments

#### Get All Pending Platform Fees
```
GET /api/admin/pending-platform-fees
Response: {
  suppliers: [
    {
      supplier_id: "sup_001",
      supplier_name: "ABC Trading",
      total_orders: 12,
      total_platform_fees: 1250.00,
      total_marketer_commissions: 2400.00,
      grand_total: 3650.00,
      orders: [...]
    }
  ],
  summary: {
    total_suppliers: 15,
    total_orders: 127,
    total_platform_fees: 12450.00,
    total_marketer_commissions: 24890.00,
    grand_total: 37340.00
  }
}
```

#### Mark Supplier Payment as Settled
```
POST /api/admin/supplier-payments/settle
Body: {
  supplier_id: "sup_001",
  order_ids: [1, 2, 3],  // specific orders or all
  amount: 3650.00,
  payment_method: "bank_transfer",
  transaction_reference: "TRX123456",
  notes: "Payment received via bank transfer"
}
```

#### Get Commission Release Report
```
GET /api/admin/commissions/pending-release
Response: {
  pending_commissions: [...],
  summary: {
    total_marketers: 23,
    total_commissions: 156,
    total_amount: 24890.00
  }
}
```

### Settlement Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Order      │────▶│  Delivered   │────▶│  Platform    │
│   Created    │     │  (Calculate) │     │  Fee Due     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                    ┌──────────────┐              │
                    │  Supplier    │◄─────────────┘
                    │  Pays        │     (Invoice/Charge)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Payment       │
                    │  Recorded      │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Marketer      │
                    │  Commission    │
                    │  Released      │
                    │  (Approved)    │
                    └────────────────┘
```

### Financial Reporting Queries

#### Monthly Platform Revenue
```sql
SELECT 
  strftime('%Y-%m', o.updated_at) as month,
  COUNT(*) as orders_count,
  SUM(o.total_amount) as total_order_value,
  SUM(o.total_platform_fee) as platform_revenue,
  SUM(o.total_commission) as marketer_payouts
FROM orders o
WHERE o.status = 'delivered'
GROUP BY strftime('%Y-%m', o.updated_at)
ORDER BY month DESC
```

#### Supplier Payment History
```sql
SELECT 
  u.name as supplier_name,
  o.id as order_id,
  o.total_platform_fee,
  o.total_commission,
  ph.payment_date,
  ph.payment_method,
  ph.transaction_reference,
  ph.status
FROM payment_history ph
JOIN orders o ON ph.order_id = o.id
JOIN users u ON o.supplier_id = u.id
ORDER BY ph.payment_date DESC
```

### Business Rules for Settlement

1. **Supplier must pay** both platform fee AND marketer commission
2. **Payment is due** within 7 days of order delivery
3. **Late payments** incur 1% penalty per week
4. **Minimum settlement** amount is 100 SAR
5. **Payment methods**: Bank transfer, STC Pay, or cash to admin
6. **Receipt required** for all payments (transaction reference)

---

## Supplier Payment Management

### Overview
Suppliers can view their pending payments to the platform, see order details, and record their settlements. This section documents the supplier-side payment management features.

### Supplier Dashboard - Payments Tab

#### Summary Cards
```
┌─────────────────────────────────────────────────────────┐
│  SUPPLIER PAYMENT SUMMARY                                       │
├──────────────────────────┬──────────────────┬─────────────────────┤
│  Total Orders Delivered  │ 127              │                     │
│  Total Sales Value       │ 245,000 SAR      │                     │
├──────────────────────────┼──────────────────┼─────────────────────┤
│  Platform Fees Due       │ 12,250 SAR       │ [Pay Now]           │
│  Marketer Commissions    │ 24,500 SAR       │ (Held for release)  │
├──────────────────────────┴──────────────────┼─────────────────────┤
│  GRAND TOTAL DUE         36,750 SAR        │ [Make Payment]      │
└─────────────────────────────────────────────┴─────────────────────┘
```

### Supplier Payment Views

#### 1. Pending Payments List
Shows all delivered orders awaiting settlement.

**Displayed Columns:**
| Column | Description |
|--------|-------------|
| Order ID | Order reference number |
| Delivery Date | When order was marked delivered |
| Client | Customer name |
| Order Total | Full order amount |
| Platform Fee (5%) | Fee owed to platform |
| Marketer Commission | Commission to be released |
| Total Due | Combined amount for this order |
| Status | pending / paid / overdue |
| Action | Pay / View Details |

**SQL Query for Supplier:**
```sql
SELECT 
  o.id as order_id,
  o.client_name,
  o.updated_at as delivery_date,
  o.total_amount,
  o.total_platform_fee,
  o.total_commission,
  (o.total_platform_fee + o.total_commission) as total_due,
  COALESCE(p.payment_status, 'pending') as payment_status,
  p.paid_at
FROM orders o
LEFT JOIN supplier_payments p ON o.id = p.order_id
WHERE o.supplier_id = ?
  AND o.status = 'delivered'
  AND (p.payment_status IS NULL OR p.payment_status = 'pending')
ORDER BY o.updated_at DESC
```

#### 2. Payment History
Shows all past payments made by the supplier.

**Displayed Columns:**
| Column | Description |
|--------|-------------|
| Payment ID | Reference number |
| Date | When payment was recorded |
| Orders Covered | Number of orders in this payment |
| Amount | Total payment amount |
| Method | Bank transfer / STC Pay / Cash |
| Reference | Transaction ID |
| Status | confirmed / pending_verification |
| Receipt | Download link |

### Supplier Payment Actions

#### 1. View Payment Details Modal
When supplier clicks on an order:
```
┌─────────────────────────────────────────────────────────┐
│  ORDER #1234 - PAYMENT DETAILS                          │
├─────────────────────────────────────────────────────────┤
│  Customer:    Ahmed Mohammed                            │
│  Delivered:   2024-03-15 14:30                          │
│  Order Total: 1,500 SAR                                 │
├─────────────────────────────────────────────────────────┤
│  BREAKDOWN:                                             │
│  ├─ Platform Fee (5%):        75.00 SAR                 │
│  ├─ Marketer Commission:     150.00 SAR                 │
│  └─ Total Amount Due:        225.00 SAR                │
├─────────────────────────────────────────────────────────┤
│  [Pay This Order]  [Pay All Pending]  [Download Invoice]  │
└─────────────────────────────────────────────────────────┘
```

#### 2. Make Payment - Form
```
Payment Amount:     [________________] SAR (auto-filled)
Payment Method:     [Bank Transfer___]▼
                    [STC Pay_________] 
                    [Cash to Admin___]

Transaction Ref:    [________________] (required for bank/STC)
                    Example: TRX123456789

Payment Date:       [2024-03-20______]

Notes:              [________________]
                    [________________]

[Submit Payment]    [Cancel]
```

### API Endpoints for Supplier Payments

#### Get Supplier's Pending Payments
```
GET /api/supplier/payments/pending
Headers: Authorization: Bearer {token}

Response: {
  summary: {
    total_orders: 12,
    total_sales: 15000.00,
    total_platform_fees: 750.00,
    total_marketer_commissions: 1500.00,
    grand_total_due: 2250.00,
    overdue_amount: 450.00,
    overdue_orders: 3
  },
  orders: [
    {
      order_id: 1234,
      client_name: "Ahmed Mohammed",
      delivery_date: "2024-03-15T14:30:00Z",
      total_amount: 1500.00,
      platform_fee: 75.00,
      marketer_commission: 150.00,
      total_due: 225.00,
      days_since_delivery: 5,
      status: "pending"
    }
  ]
}
```

#### Get Supplier's Payment History
```
GET /api/supplier/payments/history
Headers: Authorization: Bearer {token}

Response: {
  payments: [
    {
      payment_id: "PAY-2024-001",
      payment_date: "2024-03-10T10:00:00Z",
      orders_count: 5,
      total_amount: 1250.00,
      payment_method: "bank_transfer",
      transaction_reference: "TRX987654321",
      status: "confirmed",
      verified_by: "admin_user",
      verified_at: "2024-03-11T09:00:00Z",
      receipt_url: "/receipts/PAY-2024-001.pdf"
    }
  ],
  summary: {
    total_payments_made: 8,
    total_paid_amount: 8500.00,
    last_payment_date: "2024-03-10"
  }
}
```

#### Submit Payment
```
POST /api/supplier/payments/submit
Headers: Authorization: Bearer {token}
Body: {
  order_ids: [1234, 1235, 1236],
  total_amount: 675.00,
  payment_method: "bank_transfer",
  transaction_reference: "TRX123456789",
  payment_date: "2024-03-20",
  notes: "Payment for March orders"
}

Response: {
  success: true,
  payment_id: "PAY-2024-009",
  message: "Payment submitted successfully. Awaiting admin verification.",
  status: "pending_verification",
  receipt_url: "/receipts/PAY-2024-009.pdf"
}
```

#### Get Single Order Payment Details
```
GET /api/supplier/orders/:id/payment-details
Headers: Authorization: Bearer {token}

Response: {
  order: {
    id: 1234,
    client_name: "Ahmed Mohammed",
    client_phone: "966501234567",
    total_amount: 1500.00,
    delivery_date: "2024-03-15T14:30:00Z"
  },
  breakdown: {
    platform_fee_rate: 5,
    platform_fee_amount: 75.00,
    marketer_commission_rate: 10,
    marketer_commission_amount: 150.00,
    supplier_revenue: 1275.00
  },
  payment_status: "pending",
  days_overdue: 0,
  invoice_url: "/invoices/order-1234.pdf"
}
```

### Payment Status Flow (Supplier Side)

```
Order Delivered
      │
      ▼
┌─────────────┐
│   PENDING   │◄── Supplier sees in "Pending Payments"
│   PAYMENT   │
└──────┬──────┘
       │
       │ Supplier submits payment
       ▼
┌─────────────┐
│   PENDING   │◄── Awaiting admin verification
│VERIFICATION │
└──────┬──────┘
       │
       │ Admin verifies receipt
       ▼
┌─────────────┐
│   PAID /    │◄── Marketer commissions released
│  CONFIRMED  │
└─────────────┘
```

### Supplier Payment Rules & Notifications

#### Payment Rules
1. **Payment Due**: Within 7 days of order delivery
2. **Late Penalty**: 1% per week after due date
3. **Minimum Payment**: 100 SAR (can pay multiple small orders together)
4. **Partial Payments**: Not allowed - must pay full order amount
5. **Batch Payments**: Allowed - can pay multiple orders in one transaction

#### Notifications
Supplier receives notifications for:
- **New order delivered**: "Order #1234 delivered. Payment of 225 SAR due by March 22."
- **Payment due reminder**: "Payment of 450 SAR for 2 orders is due tomorrow."
- **Payment overdue**: "URGENT: Payment of 225 SAR is 3 days overdue. Late fees apply."
- **Payment received**: "Your payment of 1250 SAR has been verified. Thank you!"

### Financial Summary for Supplier

#### Monthly Statement Example
```
============================================================
           PARTNERZA - SUPPLIER STATEMENT
           March 2024
============================================================
SUPPLIER: ABC Trading Co.
STATEMENT PERIOD: March 1 - March 31, 2024

OPENING BALANCE (Feb 28):        0.00 SAR

TRANSACTIONS:
────────────────────────────────────────────────────────────
Date        | Description           | Debit    | Credit
────────────────────────────────────────────────────────────
Mar 05      | Order #1201 Delivery  |    0.00  │ 1,200.00
Mar 05      | Platform Fee (5%)     │   60.00  │    0.00
Mar 05      | Marketer Commission   │  120.00  │    0.00
Mar 12      | Order #1208 Delivery  │    0.00  │  850.00
Mar 12      | Platform Fee (5%)     │   42.50  │    0.00
Mar 12      | Marketer Commission   │   85.00  │    0.00
Mar 15      | Payment Received      │    0.00  │ -307.50
Mar 20      | Order #1234 Delivery  │    0.00  │ 1,500.00
Mar 20      | Platform Fee (5%)     │   75.00  │    0.00
Mar 20      | Marketer Commission   │  150.00  │    0.00
────────────────────────────────────────────────────────────

TOTAL SALES:                    3,550.00 SAR
TOTAL PLATFORM FEES:              177.50 SAR
TOTAL MARKETER COMMISSIONS:       355.00 SAR
TOTAL PAYMENTS MADE:              307.50 SAR

CLOSING BALANCE (Mar 31):         225.00 SAR  [DUE]
============================================================
```

### Database Tables for Supplier Payments

```sql
CREATE TABLE supplier_payments (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id             TEXT NOT NULL REFERENCES users(id),
  payment_reference       TEXT NOT NULL UNIQUE,
  total_amount            REAL NOT NULL,
  payment_method          TEXT NOT NULL,
  transaction_reference   TEXT,
  payment_date            TEXT NOT NULL,
  notes                   TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending_verification',
  submitted_at            TEXT NOT NULL DEFAULT (datetime('now')),
  verified_by             TEXT REFERENCES users(id),
  verified_at             TEXT,
  receipt_url             TEXT
);

CREATE TABLE supplier_payment_orders (
  payment_id              INTEGER NOT NULL REFERENCES supplier_payments(id),
  order_id                INTEGER NOT NULL REFERENCES orders(id),
  platform_fee            REAL NOT NULL,
  marketer_commission     REAL NOT NULL,
  PRIMARY KEY (payment_id, order_id)
);
```

---

## Complete Project Changes

### Backend (Node.js/Express)
1. **Database** (`backend/db.js`): SQLite database with sql.js for pure JavaScript implementation
2. **Firebase Admin** (`backend/firebase-admin.js`): Graceful handling of missing credentials
3. **Routes**:
   - `auth.js`: User registration and authentication
   - `products.js`: Product CRUD with image uploads
   - `links.js`: Affiliate link generation and tracking
   - `commissions.js`: Commission management
   - `withdrawals.js`: Withdrawal requests
4. **Middleware** (`verifyToken.js`): Firebase token verification

### Frontend (React/Vite)
1. **Firebase Configuration** (`firebase.js`): Updated with actual credentials
2. **API Layer** (`axios.js`): Axios instance with auth token interceptor
3. **Auth Context** (`AuthContext.jsx`): Firebase auth state management
4. **Pages**:
   - `Login.jsx`: User authentication
   - `Register.jsx`: New user registration
   - `Marketplace.jsx`: Public product listing with hero section
   - `ProductPage.jsx`: Affiliate landing page with WhatsApp integration
   - `MyLinks.jsx`: Marketer's affiliate links dashboard
   - `SupplierDashboard.jsx`: Product management for suppliers
   - `AdminDashboard.jsx`: Admin panel with tabs
   - `Withdrawals.jsx`: Withdrawal requests for marketers

### UI Improvements
- Modern gradient backgrounds
- Glass-morphism navigation bars
- Animated product cards with hover effects
- Stats dashboards
- Responsive design for all screen sizes

## How to Run the Application

### Backend
```bash
cd backend
npm install
node index.js
```
Backend runs on: http://localhost:5000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on: http://localhost:5174

## Supplier Payment Submission Feature

### Overview
Suppliers can now submit payments for delivered/completed orders directly through the Payment Management tab. Payments are made via Vodafone Cash and require admin verification.

### Payment Flow
1. Supplier selects orders using checkboxes in Payment Management tab
2. Clicks "Make Payment" button
3. Modal opens showing Vodafone Cash details (+20 10 37450540)
4. Supplier enters transaction reference, payment date, and optional notes
5. Payment is submitted and awaits admin verification
6. Admin verifies payment and marks orders as paid

### Database Schema Updates
- **supplier_payments**: Stores payment records with status (pending_verification, verified, rejected)
- **supplier_payment_orders**: Links payments to specific orders
- **orders.payment_status**: Tracks if order has been paid (pending/paid)

### API Endpoints
- `POST /api/supplier/payments/submit`: Submit payment for selected orders
- `GET /api/supplier/payments/history`: Get supplier's payment history
- `GET /api/supplier/payments/pending`: Admin endpoint to view pending payments
- `PATCH /api/supplier/payments/:id/verify`: Admin endpoint to verify/reject payments

### Frontend Changes
- Added order selection checkboxes in Payment Management grid
- Added "Make Payment" button with selected count
- Added payment modal with Vodafone Cash details
- Updated payment instructions to show Vodafone Cash instead of bank transfer

### Files Modified
- `backend/db.js`: Added supplier_payments and supplier_payment_orders tables
- `backend/routes/supplierPayments.js`: New file with payment endpoints
- `backend/index.js`: Added supplier payments route
- `frontend/src/pages/SupplierDashboard.jsx`: Added payment UI components
- `frontend/src/pages/AdminDashboard.jsx`: Added supplier payment verification tab

### Admin Payment Verification (Superadmin Panel)

The Superadmin Panel now includes a "Supplier Payments" tab that allows administrators to:

1. **View Pending Payments**: See all supplier payments awaiting verification
2. **Review Payment Details**: 
   - Supplier name and email
   - Total amount paid
   - Payment method (Vodafone Cash)
   - Transaction reference number
   - Payment date
   - Number of orders included in the payment
   - Submission date

3. **Verify or Reject Payments**:
   - Click **"Verify"** to approve the payment and mark associated orders as paid
   - Click **"Reject"** to reject the payment with optional notes
   - Add verification notes for record keeping

4. **Payment Status Flow**:
   - `pending_verification` (yellow) - Awaiting admin review
   - `verified` (green) - Payment confirmed, orders marked as paid
   - `rejected` (red) - Payment rejected

### API Endpoints (Admin)
- `GET /api/supplier/payments/pending`: Get all payments pending verification (superadmin only)
- `PATCH /api/supplier/payments/:id/verify`: Verify or reject a payment (superadmin only)
  - Request body: `{ status: 'verified' | 'rejected', notes?: string }`

---

## Firebase Service Account Setup (Required for Production)

To enable full Firebase authentication on the backend:

1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project: `partnerza`
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. Update `backend/.env` with values from the JSON:
   - `FIREBASE_PROJECT_ID`: project_id
   - `FIREBASE_PRIVATE_KEY`: private_key (keep the \n characters)
   - `FIREBASE_CLIENT_EMAIL`: client_email

## User Roles

1. **Admin**: Manage all users, products, commissions, withdrawals
2. **Supplier**: Add products with images and set commission rates
3. **Marketer**: Generate affiliate links and share products
4. **Client**: Visit product pages via affiliate links and contact marketers on WhatsApp

## Core Business Flow

1. Supplier adds a product with price, commission rate, and images
2. Marketer browses marketplace and clicks "Get My Link"
3. System generates unique affiliate link (e.g., http://localhost:5000/go/abc123)
4. Marketer shares the link on social media/WhatsApp
5. Client clicks the link → click is tracked → client sees product page
6. Client clicks "Buy via WhatsApp" → opens WhatsApp with pre-filled message
7. Marketer closes the sale on WhatsApp
8. Admin or supplier records commission manually
9. Marketer requests withdrawal when ready
10. Admin approves withdrawal

## Database Schema

- **users**: User accounts with Firebase UID as primary key
- **products**: Product listings with supplier reference
- **product_images**: Product images (max 10 per product)
- **affiliate_links**: Unique affiliate links per marketer/product
- **commissions**: Commission tracking
- **withdrawals**: Withdrawal requests

## API Endpoints

### Authentication
- `POST /api/auth/register`: Register user profile
- `GET /api/auth/me`: Get current user

### Products
- `GET /api/products`: List all products (public)
- `GET /api/products/:id`: Get single product (public)
- `POST /api/products`: Create product (supplier/admin)
- `PUT /api/products/:id`: Update product (owner/admin)
- `DELETE /api/products/:id`: Soft delete product (owner/admin)
- `POST /api/products/:id/images`: Add images (owner/admin)
- `DELETE /api/products/:id/images/:image_id`: Delete image (owner/admin)

### Affiliate Links
- `POST /api/links`: Generate link (marketer)
- `GET /api/links/mine`: Get marketer's links (marketer)
- `GET /go/:code`: Track click and get product data (public)

### Commissions
- `POST /api/commissions`: Record commission (admin/supplier)
- `GET /api/commissions`: List commissions (role-based)
- `PATCH /api/commissions/:id/status`: Update status (admin)

### Withdrawals
- `POST /api/withdrawals`: Request withdrawal (marketer)
- `GET /api/withdrawals`: List withdrawals (role-based)
- `PATCH /api/withdrawals/:id`: Update status (admin)

## Environment Variables

### Backend (.env)
```
PORT=5000
FIREBASE_PROJECT_ID=partnerza
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@partnerza.iam.gserviceaccount.com
```

### Frontend (firebase.js)
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDhofDHaUFJPiFY2jOzkG9Jfs2chOUFqAA",
  authDomain: "partnerza.firebaseapp.com",
  projectId: "partnerza",
  storageBucket: "partnerza.firebasestorage.app",
  messagingSenderId: "904830444554",
  appId: "1:904830444554:web:44187bddae99e3889debf3",
  measurementId: "G-6C4LZZKH6P"
};
```

## Important Notes

1. The backend is running in development mode without Firebase service account credentials. This allows testing all features without authentication.

2. To enable full Firebase authentication, you need to generate service account credentials from Firebase Console and update the backend `.env` file.

3. All money amounts are in SAR (Saudi Riyal).

4. Maximum 10 images per product.

5. One affiliate link per marketer per product (enforced by UNIQUE constraint).

6. WhatsApp integration uses the format: `https://wa.me/{whatsapp_number}?text={encoded_message}`

## Testing the Application

1. Start the backend server: `cd backend && node index.js`
2. Start the frontend: `cd frontend && npm run dev`
3. Open http://localhost:5174 in your browser
4. Register a new account (marketer or supplier role)
5. Test the features based on your role

## Troubleshooting

### Firebase Authentication Error
If you see `auth/configuration-not-found`:
1. Check that `frontend/src/firebase.js` has the correct Firebase config
2. Verify the Firebase project exists and has Authentication enabled
3. Ensure Email/Password sign-in is enabled in Firebase Console

### Backend Connection Error
If the backend fails to start:
1. Check that all dependencies are installed: `npm install`
2. Verify the `.env` file has correct values
3. Check that port 5000 is not in use

### Database Issues
If you encounter database errors:
1. Delete `backend/db.sqlite` if it exists
2. Restart the backend server
3. The database will be recreated automatically

## UI Enhancements with Amazon.com Theme

### Color Scheme
- Primary: Amazon Orange (#FF9900)
- Secondary: Amazon Blue (#146EB3)
- Background: Light gray (#F1F1F1)
- Text: Dark gray (#111111)
- Accent: White (#FFFFFF)

### Layout Improvements
- Amazon-style navigation bar with logo and search
- Product grid layout similar to Amazon marketplace
- Clean, minimalistic design with proper spacing
- Consistent button styles and typography

### Component Enhancements
- Product cards with hover effects and quick actions
- Dashboard widgets with statistics
- Form inputs with proper validation and styling
- Responsive navigation with mobile support