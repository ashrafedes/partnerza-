# Partnerza Database Schema Documentation

## Overview

Partnerza uses **SQLite** as its database, accessed through the **better-sqlite3** Node.js library. The database operates in WAL (Write-Ahead Logging) mode for better performance and has foreign key constraints enabled.

---

## Database Configuration

```javascript
Database: better-sqlite3
File: db.sqlite
Location: backend/db.sqlite
Journal Mode: WAL (Write-Ahead Logging)
Foreign Keys: ENABLED
```

---

## Tables Overview

| Table | Purpose | Records |
|-------|---------|---------|
| `users` | System users (suppliers, marketers, superadmin) | User accounts |
| `products` | Product catalog | Products created by suppliers |
| `product_specs` | Product specifications | Key-value specs for products |
| `product_images` | Product images | Image files linked to products |
| `orders` | Customer orders | Orders created by marketers |
| `order_items` | Order line items | Individual products in orders |
| `commissions` | Commission records | Earnings for marketers per sale |
| `withdrawals` | Withdrawal requests | Marketer payout requests |
| `payment_methods` | Payment methods | Bank accounts, STC Pay, etc. |
| `platform_settings` | System settings | Global configuration values |

---

## Table Schemas & Relationships

### 1. USERS Table

Stores all user accounts in the system.

```sql
CREATE TABLE users (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    email                       TEXT NOT NULL UNIQUE,
    phone                       TEXT,
    whatsapp                    TEXT,
    role                        TEXT NOT NULL DEFAULT 'marketer',
    status                      TEXT NOT NULL DEFAULT 'active',
    balance                     REAL NOT NULL DEFAULT 0.0,
    platform_fee_rate_override  REAL,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Role Types:**
- `superadmin` - Platform administrator
- `supplier` - Product supplier/vendor
- `marketer` - Sales/marketing agent

**Relationships:**
- Referenced by: `products.supplier_id`, `orders.marketer_id`, `commissions.marketer_id`, `withdrawals.marketer_id`, `payment_methods.marketer_id`

---

### 2. PRODUCTS Table

The product catalog. All products are created by suppliers.

```sql
CREATE TABLE products (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id                 TEXT NOT NULL REFERENCES users(id),
    name                        TEXT NOT NULL,
    description                 TEXT,
    price                       REAL NOT NULL,
    marketer_commission_rate    REAL NOT NULL,
    platform_fee_rate_override  REAL,
    category                    TEXT,
    main_image                  TEXT,
    status                      TEXT NOT NULL DEFAULT 'active',
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Status Values:**
- `active` - Available for ordering
- `inactive` - Hidden from marketplace
- `deleted` - Soft deleted

**Relationships:**
- `supplier_id` → `users.id` (Many-to-One: Supplier owns many products)
- Referenced by: `product_specs.product_id`, `product_images.product_id`, `order_items.product_id`, `commissions.product_id`

---

### 3. PRODUCT_SPECS Table

Stores product specifications as key-value pairs (e.g., "Color: Red", "Size: Large").

```sql
CREATE TABLE product_specs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    spec_key    TEXT NOT NULL,
    spec_value  TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
)
```

**Relationships:**
- `product_id` → `products.id` (Many-to-One: Product has many specs)
- **CASCADE DELETE**: When a product is deleted, its specs are automatically deleted.

---

### 4. PRODUCT_IMAGES Table

Stores image filenames linked to products. Supports multiple images per product.

```sql
CREATE TABLE product_images (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Relationships:**
- `product_id` → `products.id` (Many-to-One: Product has many images)
- **CASCADE DELETE**: When a product is deleted, its images are automatically deleted.

---

### 5. ORDERS Table

The main orders table. Orders are created by marketers on behalf of clients.

```sql
CREATE TABLE orders (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    marketer_id                 TEXT NOT NULL REFERENCES users(id),
    client_name                 TEXT NOT NULL,
    client_phone                TEXT NOT NULL,
    client_address              TEXT,
    client_notes                TEXT,
    status                      TEXT NOT NULL DEFAULT 'pending',
    supplier_note               TEXT,
    total_amount                REAL NOT NULL DEFAULT 0,
    total_commission            REAL NOT NULL DEFAULT 0,
    total_platform_fee          REAL NOT NULL DEFAULT 0,
    transportation_cost         REAL DEFAULT 0,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Status Values:**
- `pending` - Awaiting supplier confirmation
- `confirmed` - Supplier confirmed
- `shipped` - Order shipped
- `delivered` - Order delivered to client
- `rejected` - Supplier rejected
- `cancelled` - Cancelled by marketer

**Relationships:**
- `marketer_id` → `users.id` (Many-to-One: Marketer creates many orders)
- Referenced by: `order_items.order_id`, `commissions.order_id`

---

### 6. ORDER_ITEMS Table

Individual line items within an order. Each row represents one product in an order.

```sql
CREATE TABLE order_items (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id                    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id                  INTEGER NOT NULL REFERENCES products(id),
    quantity                    INTEGER NOT NULL DEFAULT 1,
    unit_price                  REAL NOT NULL,
    total_amount                REAL NOT NULL,
    marketer_commission_rate    REAL NOT NULL,
    marketer_commission_amount  REAL,
    platform_fee_rate           REAL NOT NULL,
    platform_fee_amount         REAL,
    supplier_id                 TEXT NOT NULL REFERENCES users(id),
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Relationships:**
- `order_id` → `orders.id` (Many-to-One: Order contains many items)
- `product_id` → `products.id` (Many-to-One: Item references a product)
- `supplier_id` → `users.id` (Many-to-One: Item belongs to a supplier)
- **CASCADE DELETE**: When an order is deleted, its items are automatically deleted.
- Referenced by: `commissions.order_item_id`

---

### 7. COMMISSIONS Table

Tracks commission earnings for marketers on each sale.

```sql
CREATE TABLE commissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id),
    order_item_id   INTEGER REFERENCES order_items(id),
    product_id      INTEGER REFERENCES products(id),
    marketer_id     TEXT NOT NULL REFERENCES users(id),
    amount          REAL NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    note            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Status Values:**
- `pending` - Awaiting approval
- `approved` - Approved for payout
- `rejected` - Rejected (with note)

**Relationships:**
- `order_id` → `orders.id` (Many-to-One)
- `order_item_id` → `order_items.id` (Many-to-One)
- `product_id` → `products.id` (Many-to-One)
- `marketer_id` → `users.id` (Many-to-One: Marketer earns many commissions)

---

### 8. WITHDRAWALS Table

Tracks marketer withdrawal/payout requests.

```sql
CREATE TABLE withdrawals (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    marketer_id         TEXT NOT NULL REFERENCES users(id),
    amount              REAL NOT NULL,
    bank_name           TEXT NOT NULL,
    iban                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    admin_note          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at        TEXT,
    payment_method_id   INTEGER REFERENCES payment_methods(id)
)
```

**Status Values:**
- `pending` - Awaiting admin approval
- `approved` - Approved
- `rejected` - Rejected (with admin_note)
- `paid` - Payment sent to marketer

**Relationships:**
- `marketer_id` → `users.id` (Many-to-One: Marketer makes many withdrawals)
- `payment_method_id` → `payment_methods.id` (Many-to-One)

---

### 9. PAYMENT_METHODS Table

Stores marketer payment methods for withdrawals.

```sql
CREATE TABLE payment_methods (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    marketer_id             TEXT NOT NULL REFERENCES users(id),
    method_type             TEXT NOT NULL,
    account_name            TEXT NOT NULL,
    account_number_or_iban  TEXT NOT NULL,
    bank_name               TEXT,
    is_default              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Method Types:**
- `Bank Transfer`
- `STC Pay`
- `PayPal`
- `Other`

**Relationships:**
- `marketer_id` → `users.id` (Many-to-One: Marketer has many payment methods)
- Referenced by: `withdrawals.payment_method_id`

---

### 10. PLATFORM_SETTINGS Table

Key-value store for global platform configuration.

```sql
CREATE TABLE platform_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
)
```

**Default Settings:**
- `default_platform_fee_rate` - Platform commission percentage (default: 5%)
- `min_withdrawal_amount` - Minimum withdrawal amount (default: 100 SAR)

---

## Entity Relationship Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    USERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK) ────────────┬─────────────────────────────────────────────────────────│
│ name                │         ┌─────────────────┐                          │
│ email               │         │   PAYMENT_METHODS│                          │
│ phone               │         ├─────────────────┤                          │
│ whatsapp            │         │ id (PK)         │                          │
│ role                │◄────────│ marketer_id (FK)│                          │
│ balance             │         │ method_type     │                          │
│ platform_fee_rate   │         │ account_name    │                          │
└─────────────────────┴─────────┴─────────────────┴───────────────────────────┘
          │
          │ 1:M
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  PRODUCTS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK) ──────────────────┬─────────────────────────────────────────────────│
│ supplier_id (FK) ─────────┼───────────┐                                     │
│ name                      │           │         ┌─────────────────────┐       │
│ description               │           │         │   PRODUCT_SPECS     │       │
│ price                     │           │         ├─────────────────────┤       │
│ marketer_commission_rate  │           │         │ id (PK)             │       │
│ status                    │           │         │ product_id (FK)     │       │
└───────────────────────────┼───────────┼────────►│ spec_key            │       │
          │                 │           │         │ spec_value          │       │
          │                 │           │         └─────────────────────┘       │
          │ 1:M           │           │                                         │
          │               │           │         ┌─────────────────────┐         │
          │               │           │         │   PRODUCT_IMAGES    │         │
          │               │           │         ├─────────────────────┤         │
          │               │           │         │ id (PK)             │         │
          │               │           │         │ product_id (FK)     │         │
          │               │           │         │ filename            │         │
          │               │           │         └─────────────────────┘         │
          ▼               │           │                                         │
┌─────────────────────────────────────────────────────────────────────────────┐
│                                ORDER_ITEMS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK) ──────────────────┬─────────────────────────────────────────────────│
│ order_id (FK) ────────────┼─────────────────────────────────────────────────│
│ product_id (FK) ◄─────────┼─────────────────────────────────────────────────│
│ quantity                  │                                                 │
│ unit_price                │                                                 │
│ total_amount              │                                                 │
│ marketer_commission_rate  │                                                 │
│ marketer_commission_amount│                                                 │
│ platform_fee_rate         │                                                 │
│ platform_fee_amount       │                                                 │
│ supplier_id (FK) ◄──────┘                                                 │
└───────────────────────────┬─────────────────────────────────────────────────┘
          │
          │ M:1
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   ORDERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK) ──────────────────┬─────────────────────────────────────────────────│
│ marketer_id (FK) ◄────────┘                                                 │
│ client_name                                                                 │
│ client_phone                                                                │
│ client_address                                                              │
│ client_notes                                                                │
│ status                                                                      │
│ total_amount                                                                │
│ total_commission                                                            │
│ total_platform_fee                                                          │
│ transportation_cost                                                         │
└───────────────────────────┬─────────────────────────────────────────────────┘
          │
          │ 1:M
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                COMMISSIONS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK)                                                                     │
│ order_id (FK) ◄────────────────────────────────────────────────────────────│
│ order_item_id (FK) ◄────────────────────────────────────────────────────────│
│ product_id (FK) ◄───────────────────────────────────────────────────────────│
│ marketer_id (FK) ◄──────────────────────────────────────────────────────────│
│ amount                                                                      │
│ status                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                WITHDRAWALS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (PK)                                                                     │
│ marketer_id (FK) ◄──────────────────────────────────────────────────────────│
│ amount                                                                      │
│ bank_name                                                                   │
│ iban                                                                        │
│ status                                                                      │
│ admin_note                                                                  │
│ payment_method_id (FK) ◄────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             PLATFORM_SETTINGS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ key (PK)                                                                    │
│ value                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### 1. Creating a New Product

1. Supplier logs in → authenticated via `users` table
2. Supplier creates product → new row in `products` table
3. Product specs added → rows in `product_specs` table
4. Product images uploaded → rows in `product_images` table

### 2. Placing an Order

1. Marketer logs in → authenticated via `users` table
2. Marketer creates order → new row in `orders` table
3. Order items added → rows in `order_items` table
4. Commissions calculated → rows in `commissions` table

### 3. Order Lifecycle

```
Pending → Confirmed → Shipped → Delivered
   │          │          │          │
   │          │          │          └── Commissions become 'approved'
   │          │          │
   │          │          └── Supplier marks as shipped
   │          │
   │          └── Supplier confirms order
   │
   └── Order created by marketer
```

### 4. Withdrawal Process

1. Marketer requests withdrawal → new row in `withdrawals` table
2. Admin reviews and approves → `status` changes to 'approved'
3. Payment sent → `status` changes to 'paid', `processed_at` timestamp added

---

## Key Calculations

### Commission Calculation

```javascript
item_total = unit_price × quantity
commission_amount = item_total × (marketer_commission_rate / 100)
platform_fee_amount = item_total × (platform_fee_rate / 100)
```

### Order Total Calculation

```javascript
order.total_amount = SUM(order_items.total_amount)
order.total_commission = SUM(order_items.marketer_commission_amount)
order.total_platform_fee = SUM(order_items.platform_fee_amount)
```

### Platform Fee Rate Determination

Priority order (highest wins):
1. `product.platform_fee_rate_override` (if set)
2. `marketer.platform_fee_rate_override` (if set)
3. `platform_settings.default_platform_fee_rate` (default: 5%)

---

## Soft Delete Pattern

The application uses soft delete for products to preserve order history:

```sql
-- Instead of DELETE:
UPDATE products SET status = 'deleted' WHERE id = ?;

-- Queries filter out deleted products:
SELECT * FROM products WHERE status != 'deleted';
```

---

## Database Migration Strategy

New columns are added using `ALTER TABLE` with try-catch blocks for backward compatibility:

```javascript
try {
  db.exec(`ALTER TABLE commissions ADD COLUMN product_id INTEGER REFERENCES products(id)`);
} catch (e) {
  // Column already exists — safe to ignore
}
```

---

## File Location

```
c:/My projects/Partnerza/backend/db.sqlite
```

The database is automatically created when the backend starts if it doesn't exist.

---

## Summary

- **10 tables** managing users, products, orders, commissions, and payments
- **Foreign key constraints** ensure data integrity
- **Soft deletes** preserve historical data
- **WAL mode** for better concurrency
- **Automatic migrations** for schema updates
