PARTNERZA — SYSTEM PROMPT v2.0
Direct Sales Agent Platform  |  Updated Architecture
Instructions for AI Code Generator
IMPORTANT: You are a senior full-stack developer. Build the complete Partnerza web application exactly as specified. Do not skip steps, do not guess, do not add unlisted features. After any changes save all instructions and changes to a text file called Scenario.md. Build the webapp theme similar to Amazon.com (orange + dark navy color scheme, layout, typography).

1. WHAT IS PARTNERZA?
Partnerza is a Direct Sales Agent platform. Marketers act as independent sales agents who present product information to clients, collect order requests, and earn commissions on confirmed sales. There are no shareable affiliate links — all sales happen through structured order submissions within the platform.

Role	What They Do
superadmin	Manages the entire platform, sets default platform fee rates, can override rates per product or per marketer
supplier	Adds products with full specs and images, sets marketer commission rate per product, confirms or rejects orders
marketer	Browses products, presents specs/images to clients outside the platform, submits client orders, earns commissions
client	Receives product information from marketer, agrees to purchase, and the marketer submits an order on their behalf

1.1 Core Business Flow
Memorize this sequence — it drives every feature:
1.	Supplier adds a product with full details: name, description, specifications (key-value pairs), price, up to 10 images, and marketer commission rate.
2.	Marketer browses the marketplace, views full product specs and images, and selects products to represent.
3.	Marketer presents product details to potential clients through any external channel (WhatsApp, phone, in-person). The platform provides a printable/shareable product sheet.
4.	When a client agrees to buy, the marketer returns to the platform and submits an Order Request: client name, client phone, product, quantity, and delivery address.
5.	Order is created with status 'pending'. Supplier receives the order and reviews it.
6.	Supplier confirms or rejects the order. On confirmation, the system automatically calculates and records: marketer commission = order_total × marketer_commission_rate, platform fee = order_total × platform_fee_rate.
7.	Supplier marks the order as 'shipped' then 'delivered' as fulfillment progresses.
8.	Marketer's balance is updated when commission status becomes 'approved'.
9.	Marketer requests a withdrawal. Superadmin approves and processes payment.

2. COMMISSION & FEE STRUCTURE
This is a two-layer commission model:

Layer	Who Sets It	Where Stored	Description
Marketer Commission Rate	Supplier (per product)	products.marketer_commission_rate	% of order total paid to marketer on confirmed order
Platform Fee Rate — Default	Superadmin (global)	platform_settings.default_platform_fee_rate	Default % taken by the platform from every order
Platform Fee Rate — Override	Superadmin (per product or per marketer)	products.platform_fee_rate_override / users.platform_fee_rate_override	Overrides the global default for specific products or marketers

2.1 Commission Calculation Logic
When an order is confirmed by the supplier, the backend calculates automatically:
const effectivePlatformRate = product.platform_fee_rate_override
  ?? marketer.platform_fee_rate_override
  ?? platformSettings.default_platform_fee_rate;

const marketerCommission = order.total_amount * (product.marketer_commission_rate / 100);
const platformFee        = order.total_amount * (effectivePlatformRate / 100);
const supplierNet        = order.total_amount - marketerCommission - platformFee;
⚠ The supplier_net is informational only. Actual money movement is handled outside the platform. The platform only tracks balances for marketers.

3. TECHNOLOGY STACK
Use exactly these technologies. Do not replace or add any.

3.1 Backend
Package	Purpose
Node.js + Express.js	Runtime and HTTP framework
better-sqlite3	SQLite database (synchronous, local file)
firebase-admin	Verify Firebase ID tokens only — no Firestore
multer	Handle multipart/form-data image uploads to local disk
nanoid v3 (CommonJS)	Generate short unique codes
dotenv	Load environment variables from .env
cors	Allow requests from frontend origin

3.2 Frontend
Package	Purpose
React 18 + Vite	UI framework and build tool
Tailwind CSS	Utility-first CSS — Amazon-style color theme
React Router v6	Client-side routing
Axios	HTTP client with interceptors for auth token
Firebase JS SDK	Client-side login/register only

3.3 Authentication Architecture
⚠ CRITICAL — read carefully before building
•	Firebase is used ONLY for createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, getIdToken, signOut.
•	Firebase does NOT store user profile data. No Firestore. No Realtime DB.
•	After Firebase login, frontend sends Firebase ID Token to backend in Authorization header.
•	Backend verifies token with Firebase Admin SDK, then looks up user in SQLite by UID.
•	All user data (name, role, balance, commission overrides) lives in SQLite only.

4. PROJECT FOLDER STRUCTURE
Create exactly this structure. Do not rename folders.
partnerza/
├── backend/
│   ├── .env
│   ├── package.json
│   ├── index.js                   ← Express entry point
│   ├── db.js                      ← SQLite connection + schema
│   ├── firebase-admin.js          ← Firebase Admin init
│   ├── uploads/                   ← Product images (create folder)
│   ├── middleware/
│   │   └── verifyToken.js
│   └── routes/
│       ├── auth.js                ← Register / profile
│       ├── products.js            ← CRUD + image upload
│       ├── orders.js              ← Order lifecycle
│       ├── commissions.js         ← Auto + manual commission records
│       ├── withdrawals.js         ← Withdrawal requests
│       ├── paymentMethods.js      ← Marketer payment methods [NEW]
│       └── settings.js            ← Platform fee settings (superadmin)
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── firebase.js
        ├── api/
        │   └── axios.js
        ├── context/
        │   └── AuthContext.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── Marketplace.jsx       ← Browse products (all logged-in users)
            ├── ProductDetail.jsx     ← Full specs + images for marketer
            ├── SubmitOrder.jsx       ← Marketer submits order for client
            ├── MarketerDashboard.jsx ← Marketer: orders + payment + methods [UPDATED]
            ├── SupplierDashboard.jsx ← Supplier: products + orders + payment + balance [UPDATED]
            └── AdminDashboard.jsx    ← Superadmin: users, settings, reports

5. DATABASE SCHEMA — SQLite
File: backend/db.sqlite. Auto-created on first server start via db.js. Use CREATE TABLE IF NOT EXISTS on all tables. Enable foreign keys: db.pragma('foreign_keys = ON').

Table: users
CREATE TABLE IF NOT EXISTS users (
  id                          TEXT PRIMARY KEY,   -- Firebase UID
  name                        TEXT NOT NULL,
  email                       TEXT NOT NULL UNIQUE,
  phone                       TEXT,
  whatsapp                    TEXT,               -- digits + country code
  role                        TEXT NOT NULL DEFAULT 'marketer',
  -- values: superadmin | supplier | marketer
  status                      TEXT NOT NULL DEFAULT 'active',
  -- values: active | suspended
  balance                     REAL NOT NULL DEFAULT 0.0,
  platform_fee_rate_override  REAL,
  -- NULL = use product or global default
  -- set by superadmin per marketer
  created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

Table: products
CREATE TABLE IF NOT EXISTS products (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id                 TEXT NOT NULL REFERENCES users(id),
  name                        TEXT NOT NULL,
  description                 TEXT,
  price                       REAL NOT NULL,
  marketer_commission_rate    REAL NOT NULL,  -- % earned by marketer
  platform_fee_rate_override  REAL,           -- NULL = use global default
  category                    TEXT,
  status                      TEXT NOT NULL DEFAULT 'active',
  -- values: active | paused | deleted
  created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

Table: product_specs
Stores structured key-value specifications per product (e.g. Color: Red, Weight: 2kg). Displayed as a spec table on ProductDetail page.
CREATE TABLE IF NOT EXISTS product_specs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  spec_key    TEXT NOT NULL,   -- e.g. 'Color', 'Weight', 'Dimensions'
  spec_value  TEXT NOT NULL,   -- e.g. 'Red', '2kg', '30x20x10 cm'
  sort_order  INTEGER NOT NULL DEFAULT 0
);

Table: product_images
CREATE TABLE IF NOT EXISTS product_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
Image URL rule: http://localhost:5000/uploads/{filename}

Table: orders
Created by a marketer when a client agrees to buy. One row per order.
CREATE TABLE IF NOT EXISTS orders (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  marketer_id               TEXT NOT NULL REFERENCES users(id),
  supplier_id               TEXT NOT NULL REFERENCES users(id),
  product_id                INTEGER NOT NULL REFERENCES products(id),
  quantity                  INTEGER NOT NULL DEFAULT 1,
  unit_price                REAL NOT NULL,   -- snapshot of price at order time
  total_amount              REAL NOT NULL,   -- unit_price * quantity
  marketer_commission_rate  REAL NOT NULL,   -- snapshot of rate at order time
  platform_fee_rate         REAL NOT NULL,   -- effective rate at order time
  marketer_commission_amount REAL,           -- calculated on confirmation
  platform_fee_amount        REAL,           -- calculated on confirmation
  client_name               TEXT NOT NULL,
  client_phone              TEXT NOT NULL,
  client_address            TEXT,
  client_notes              TEXT,
  status                    TEXT NOT NULL DEFAULT 'pending',
  -- values: pending | confirmed | rejected | shipped | delivered | cancelled
  supplier_note             TEXT,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

Table: commissions
Auto-created when an order is confirmed. One row per confirmed order.
CREATE TABLE IF NOT EXISTS commissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id),
  marketer_id  TEXT NOT NULL REFERENCES users(id),
  amount       REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  -- values: pending | approved | paid
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

Table: withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  marketer_id  TEXT NOT NULL REFERENCES users(id),
  amount       REAL NOT NULL,
  bank_name    TEXT NOT NULL,
  iban         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  -- values: pending | approved | rejected | paid
  admin_note   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

Table: platform_settings
Key-value store for global platform configuration. Managed only by superadmin.
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default values on first run:
INSERT OR IGNORE INTO platform_settings (key, value)
VALUES ('default_platform_fee_rate', '5');

6. BACKEND — ROUTE SPECIFICATIONS
6.1 backend/.env
PORT=5000
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@project.iam.gserviceaccount.com

6.2 verifyToken.js middleware
Same as before: reads Authorization: Bearer <token>, verifies with Firebase Admin, looks up user in SQLite, attaches to req.user. Returns 401 if token invalid, 403 if user not in SQLite.

6.3 routes/auth.js
POST /api/auth/register — Public
•	Body: { uid, name, email, role, phone, whatsapp }
•	Role must be 'marketer' or 'supplier' only. Users cannot self-register as superadmin.
•	Action: INSERT into users. If UID already exists, do nothing (upsert).
•	Response: { message: 'User registered', user }
GET /api/auth/me — Protected
•	Returns req.user from SQLite.

6.4 routes/products.js
GET /api/products — Public
•	Returns all active products with: id, name, description, price, marketer_commission_rate, category, supplier_name, main_image (first image filename).
GET /api/products/:id — Public
•	Returns full product: all fields + images array + specs array + supplier_name.
•	Specs returned as: [ { spec_key, spec_value, sort_order }, ... ]
POST /api/products — Protected: supplier or superadmin
•	Content-Type: multipart/form-data
•	Text fields: name, description, price, marketer_commission_rate, platform_fee_rate_override (optional), category
•	Text field: specs — JSON string array of { spec_key, spec_value, sort_order } objects
•	Files field: images — up to 10 files, JPEG/PNG/WebP, max 5MB each
•	Action: insert product → insert specs → insert images
•	Response: { message: 'Product created', product_id }
PUT /api/products/:id — Protected: owning supplier or superadmin
•	Body JSON: { name, description, price, marketer_commission_rate, platform_fee_rate_override, category, status }
•	Does NOT update images or specs in this endpoint.
PUT /api/products/:id/specs — Protected: owning supplier or superadmin
•	Body JSON: { specs: [ { spec_key, spec_value, sort_order } ] }
•	Action: DELETE all existing specs for this product, then INSERT the new set.
POST /api/products/:id/images — Protected: owning supplier or superadmin
•	Same logic as original: count existing images, reject if total > 10, insert new.
DELETE /api/products/:id/images/:image_id — Protected: owning supplier or superadmin
•	Delete row from product_images + delete physical file from uploads/.
DELETE /api/products/:id — Protected: owning supplier or superadmin
•	Soft delete: set status = 'deleted'. Do not remove the row.

6.5 routes/orders.js
POST /api/orders — Protected: marketer only
•	Body: { product_id, quantity, client_name, client_phone, client_address, client_notes }
Actions:
◦	Fetch product to get current price, marketer_commission_rate, platform_fee_rate_override, supplier_id.
◦	Fetch platform_settings to get default_platform_fee_rate.
◦	Resolve effective_platform_fee_rate: product.platform_fee_rate_override ?? marketer.platform_fee_rate_override ?? default_platform_fee_rate.
◦	Calculate: total_amount = unit_price * quantity.
◦	INSERT into orders with all calculated fields and status = 'pending'.
◦	Response: { message: 'Order submitted', order_id }
GET /api/orders — Protected
•	superadmin: all orders with marketer name, supplier name, product name
•	supplier: orders where supplier_id = req.user.id
•	marketer: orders where marketer_id = req.user.id
•	Support query param ?status= to filter by status
•	Response: array of order objects
GET /api/orders/:id — Protected
•	Returns full order detail. User must be the marketer, supplier, or superadmin.
PATCH /api/orders/:id/status — Protected: supplier or superadmin
•	Body: { status, supplier_note }
•	Allowed status transitions: pending → confirmed | rejected; confirmed → shipped; shipped → delivered; any → cancelled
On status = 'confirmed':
◦	Calculate marketer_commission_amount = total_amount * marketer_commission_rate / 100
◦	Calculate platform_fee_amount = total_amount * platform_fee_rate / 100
◦	UPDATE orders: set both calculated amounts + updated_at
◦	INSERT into commissions: { order_id, marketer_id, amount: marketer_commission_amount, status: 'pending' }
On status = 'rejected' or 'cancelled':
◦	No commission action needed.
•	Response: { message: 'Order status updated' }

6.6 routes/commissions.js
GET /api/commissions — Protected
•	superadmin: all commissions with marketer name, order id, product name
•	marketer: only own commissions
•	supplier: commissions for orders on their products
PATCH /api/commissions/:id/status — Protected: superadmin only
•	Body: { status } — allowed: pending | approved | paid
•	On status = 'approved': UPDATE users SET balance = balance + amount WHERE id = marketer_id
•	Response: { message: 'Commission status updated' }

6.7 routes/withdrawals.js
Same as original spec: POST /api/withdrawals (marketer), GET /api/withdrawals (role-filtered), PATCH /api/withdrawals/:id (superadmin). Refund balance on rejection.

6.8 routes/settings.js — Platform Fee Settings
GET /api/settings — Protected: superadmin only
•	Returns all rows from platform_settings as a key-value object.
•	Also returns list of all marketers with their platform_fee_rate_override values.
PUT /api/settings — Protected: superadmin only
•	Body: { key, value } — e.g. { key: 'default_platform_fee_rate', value: '7' }
•	UPSERT into platform_settings.
PATCH /api/settings/marketer/:id — Protected: superadmin only
•	Body: { platform_fee_rate_override } — set null to remove override
•	UPDATE users SET platform_fee_rate_override = ? WHERE id = ?
PATCH /api/settings/product/:id — Protected: superadmin only
•	Body: { platform_fee_rate_override } — set null to remove override
•	UPDATE products SET platform_fee_rate_override = ? WHERE id = ?

6.9 backend/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',            require('./routes/auth'));
app.use('/api/products',        require('./routes/products'));
app.use('/api/orders',          require('./routes/orders'));
app.use('/api/commissions',     require('./routes/commissions'));
app.use('/api/withdrawals',     require('./routes/withdrawals'));
app.use('/api/settings',        require('./routes/settings'));
app.use('/api/payment-methods', require('./routes/paymentMethods'));

app.listen(process.env.PORT || 5000, () =>
  console.log('Partnerza backend running on port', process.env.PORT || 5000)
);

6.10 backend/package.json dependencies
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "cors":           "^2.8.5",
    "dotenv":         "^16.0.0",
    "express":        "^4.18.0",
    "firebase-admin": "^12.0.0",
    "multer":         "^1.4.5-lts.1",
    "nanoid":         "^3.3.7"
  }
}
⚠ Use nanoid v3 only (CommonJS compatible). v4+ is ESM only and breaks with require().

7. FRONTEND — PAGE SPECIFICATIONS
7.1 Routing Table
Path	Component	Access
/login	Login.jsx	Public
/register	Register.jsx	Public
/marketplace	Marketplace.jsx	Protected — all logged-in roles
/products/:id	ProductDetail.jsx	Protected — all logged-in roles
/products/:id/order	SubmitOrder.jsx	Protected — marketer only
/marketer	MarketerDashboard.jsx	Protected — marketer only (replaces /my-orders + /withdrawals)
/supplier	SupplierDashboard.jsx	Protected — supplier only
/admin	AdminDashboard.jsx	Protected — superadmin only
/	Redirect to /marketplace	—

7.2 Login.jsx
•	Fields: email, password.
•	On success: redirect based on role — superadmin → /admin, supplier → /supplier, marketer → /marketplace.

7.3 Register.jsx
•	Fields: name, email, password, phone, WhatsApp, role (marketer or supplier only — no superadmin option).
•	Step 1: createUserWithEmailAndPassword(auth, email, password).
•	Step 2: POST /api/auth/register with uid + form data.
•	Redirect to /login on success.

7.4 Marketplace.jsx
•	Calls GET /api/products on mount.
•	Shows a product grid (Amazon-style cards): main image, name, price in SAR, commission rate, category, supplier name.
•	Each card has a 'View Details' button → navigates to /products/:id.
•	Marketer-only: card also shows 'Submit Order' shortcut button → /products/:id/order.
•	Filter bar: by category, by min/max price, by commission rate range, search by name.

7.5 ProductDetail.jsx
•	Calls GET /api/products/:id on mount.
•	Image gallery: large main image, thumbnail strip below (click thumbnail to switch main image).
•	Shows: product name, description, price in SAR, commission rate %, category, supplier name.
•	Specifications table: renders all product_specs rows as Key | Value table.
•	Button for marketer: 'Submit Order for Client' → /products/:id/order.
•	Button: 'Print / Share Specs' → opens browser print dialog for a clean spec sheet.
⚠ The print view should hide all navigation and show only product info + images — use a @media print CSS class.

7.6 SubmitOrder.jsx
•	Protected: marketer only.
•	Loads product data from GET /api/products/:id.
•	Shows product summary (name, price, commission rate).
•	Form fields: client_name (text), client_phone (text), quantity (number, min 1), client_address (text), client_notes (textarea, optional).
•	Live preview: total_amount = price × quantity, estimated commission = total × commission_rate%.
•	On submit: POST /api/orders.
•	On success: show confirmation message and 'View My Orders' link.

7.7 MarketerDashboard.jsx  [UPDATED — replaces MyOrders + Withdrawals]
Protected: marketer only. Four tabs at the top of the page.
⚠ This page replaces both MyOrders.jsx and Withdrawals.jsx. Update the folder structure accordingly.
Tab 1 — Order Management
•	Calls GET /api/orders on mount (marketer's own orders only).
•	Table columns: Order ID | Product | Client Name | Quantity | Total SAR | Commission SAR | Status | Date.
•	Status badge colors: pending=yellow, confirmed=blue, shipped=purple, delivered=green, rejected/cancelled=red.
•	Sub-tabs filter: All | Pending | Confirmed | Delivered | Rejected.
Tab 2 — Payment Management
Balance Summary Card shown at the top:
•	Marketer Commission Balance — approved commissions credited (users.balance).
•	Pending Commission — SUM of commissions with status='pending' from commissions table.
•	Platform Commission (read-only, informational) — SUM of platform_fee_amount on marketer's confirmed orders from orders table. Shown so marketer understands the deduction.
Withdrawal Request Form (below the balance card):
•	Amount input — max = users.balance. Frontend validates; backend also enforces.
•	Minimum withdrawal hint — fetch platform_settings key 'min_withdrawal_amount' and display below the field.
•	Payment Method selector — dropdown of marketer's saved payment methods. Must select one to submit.
•	POST /api/withdrawals with body { amount, payment_method_id } on submit.
•	Refresh balance card on success.
Withdrawal History table: Request ID | Amount | Method Used | Status | Date | Admin Note.
Tab 3 — Payment Methods
•	List all saved methods: Type | Account Name | Account / IBAN | Bank Name | Default badge.
•	'Add Payment Method' form fields: method_type (Bank Transfer | STC Pay | PayPal | Other), account_name, account_number_or_iban, bank_name (required for Bank Transfer only), is_default checkbox.
•	POST /api/payment-methods to add. DELETE /api/payment-methods/:id to remove.
•	PATCH /api/payment-methods/:id/default to mark as default.
•	At least one method must be saved before a withdrawal request can be submitted.
Tab 4 — Commission History
•	Calls GET /api/commissions — returns marketer's own records.
•	Table: Commission ID | Order ID | Product | Amount SAR | Status | Date.
•	Status badges: pending=yellow, approved=blue, paid=green.

7.8 SupplierDashboard.jsx  [UPDATED — 4 tabs]
Tabs: Product Management | Order Management | Payment Management | Balance
Tab 1 — Product Management:
•	Shows list of supplier's products with status badge, image count, commission rate.
•	'Add Product' button opens a form with: name, description, price, marketer_commission_rate, platform_fee_rate_override (optional), category.
•	Specs section: dynamic Key + Value rows. 'Add Spec' adds a row. Trash icon removes one.
•	Images section: file input (multiple, max 10), preview thumbnails before upload.
•	Submit sends multipart/form-data with specs as JSON string.
•	Existing products: 'Edit', 'Add Images', 'Manage Specs', 'Pause/Activate', 'Delete' actions.
Tab 2 — Order Management:
•	Calls GET /api/orders filtered to this supplier.
•	Table: Order ID | Marketer Name | Product | Client Name | Quantity | Total SAR | Commission to Marketer | Platform Fee | Supplier Net | Status.
•	For pending orders: 'Confirm' and 'Reject' buttons → PATCH /api/orders/:id/status.
•	For confirmed: 'Mark Shipped'; for shipped: 'Mark Delivered'.
•	Supplier note input shown on confirm/reject actions.
Tab 3 — Payment Management:
This tab manages the supplier's payment obligations to the platform:
•	Pending Payments table — lists all confirmed orders where platform has not yet collected. Columns: Order ID | Marketer | Total Order SAR | Marketer Commission SAR | Platform Fee SAR | Supplier Net SAR | Collect Status.
•	'Collect Status' tracks whether the supplier has paid the platform: unpaid | paid. Superadmin updates this status.
•	Totals row at the bottom: sum of all pending amounts.
•	Payment instructions banner — static text explaining: 'Transfer the total due to the platform bank account. The platform will then release marketer commissions. Contact admin for payment details.'
⚠ The platform receives the full order amount from the supplier, deducts the platform fee, and forwards the marketer commission to the marketer's balance upon approval.
Tab 4 — Balance:
Summary cards showing financial overview for the supplier's account:
•	Total Commission Owed to Marketers — SUM of marketer_commission_amount on all confirmed orders.
•	Total Platform Fees Due — SUM of platform_fee_amount on all confirmed orders.
•	Supplier Net Revenue — SUM of (total_amount - marketer_commission_amount - platform_fee_amount) on delivered orders.
•	A bar chart or summary table grouped by month (last 6 months): Orders Confirmed | Revenue | Commission Paid | Platform Fees.
⚠ Balance is informational only — no actual money is held in the platform for suppliers. All financial settlement happens externally.

7.9 AdminDashboard.jsx (Superadmin)
Tabs: Users | Products | Orders | Commissions | Withdrawals | Platform Settings
Users tab:
•	List all users: name, email, role, status, balance, platform_fee_rate_override.
•	Suspend/activate users.
•	Set per-marketer platform_fee_rate_override → PATCH /api/settings/marketer/:id.
Products tab:
•	List all products with supplier name, status, commission rate, platform fee override.
•	Set per-product platform_fee_rate_override → PATCH /api/settings/product/:id.
•	Soft-delete products.
Orders tab:
•	List all orders with marketer, supplier, product, client name, amounts, status.
•	Filter by status.
Commissions tab:
•	List all commissions. Change status: pending → approved (triggers balance credit) → paid.
Withdrawals tab:
•	List all withdrawal requests. Approve / reject / mark paid with admin note.
Platform Settings tab:
•	Show current default_platform_fee_rate with an editable number input.
•	Save button → PUT /api/settings.
•	Explanation text: 'This rate applies to all orders unless overridden at product or marketer level.'

7.10 Payment Flow — Platform Role  [NEW]
The platform acts as the payment intermediary between supplier and marketer:
10.	Order is confirmed by supplier → marketer_commission_amount and platform_fee_amount are calculated and stored on the order row.
11.	Supplier sees the total due in their Payment Management tab and transfers the full order amount to the platform externally.
12.	Superadmin marks the commission status as 'approved' → this credits the marketer_commission_amount into the marketer's balance (users.balance).
13.	Marketer requests a withdrawal from their balance, selects a saved payment method, and specifies the amount.
14.	Superadmin approves the withdrawal and transfers the amount to the marketer's selected payment method externally. Sets withdrawal status to 'paid'.
⚠ The platform retains the platform_fee_amount. Marketer receives only marketer_commission_amount. Supplier receives the net after both deductions.

7.11 New Backend Routes Required  [NEW — payment methods]
GET /api/payment-methods — Protected: marketer only
•	Returns all payment methods for req.user.id from payment_methods table.
POST /api/payment-methods — Protected: marketer only
•	Body: { method_type, account_name, account_number_or_iban, bank_name, is_default }
•	If is_default = true: set all other methods for this marketer to is_default = false first.
•	INSERT into payment_methods.
PATCH /api/payment-methods/:id/default — Protected: marketer only
•	Set is_default = false for all marketer's methods, then is_default = true for :id.
DELETE /api/payment-methods/:id — Protected: marketer only
•	Delete the payment method. Cannot delete if it is the only method and has pending withdrawals.
Update POST /api/withdrawals to require payment_method_id in the body and store it on the withdrawal row.
Add platform_settings seed: INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('min_withdrawal_amount', '100');

7.12 New DB Table Required  [NEW — payment_methods]
CREATE TABLE IF NOT EXISTS payment_methods (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  marketer_id             TEXT NOT NULL REFERENCES users(id),
  method_type             TEXT NOT NULL,
  -- values: Bank Transfer | STC Pay | PayPal | Other
  account_name            TEXT NOT NULL,
  account_number_or_iban  TEXT NOT NULL,
  bank_name               TEXT,   -- required for Bank Transfer only
  is_default              INTEGER NOT NULL DEFAULT 0,  -- 0=false, 1=true
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Also add payment_method_id column to withdrawals table:
ALTER TABLE withdrawals ADD COLUMN payment_method_id INTEGER
  REFERENCES payment_methods(id);
⚠ Add the ALTER TABLE statement inside db.js wrapped in a try-catch so it is safely skipped if the column already exists on subsequent server restarts.

8. RULES & CONSTRAINTS
#	Rule
1	NEVER use Firestore — no getFirestore(), collection(), addDoc() anywhere.
2	NEVER store user data in Firebase — SQLite only.
3	Firebase is ONLY for: createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, getIdToken, signOut.
4	Images stored as files in backend/uploads/ — not as base64 in the database.
5	Maximum 10 images per product — enforced on both backend (multer + count check) and frontend (file input validation).
6	No affiliate links, no shareable tracking URLs — all orders are submitted through authenticated marketer sessions.
7	No cart, no payment gateway — orders are requests only. All real money movement (supplier → platform → marketer) happens externally. The platform tracks balances only.
8	Commission is auto-calculated on order confirmation — NOT entered manually.
9	Superadmin is the only role who can change platform fee rates and approve withdrawals. Suppliers cannot change the platform fee.
10	Suppliers set marketer_commission_rate per product. Superadmin can override platform_fee_rate per product or per marketer.
11	All money amounts are in SAR (Saudi Riyal).
12	Use nanoid v3 (CommonJS) — not v4+.
13	Use plain JavaScript — no TypeScript.
14	Always validate user roles on the backend — never trust the frontend alone.
15	All API responses must be JSON. Errors: { error: 'message' }. Success: { message: 'text', ...data }.
16	Users cannot self-register as superadmin. Superadmin accounts are created manually in the database.
17	Status transitions on orders must be validated server-side — do not allow invalid transitions.
18	A marketer must have at least one saved payment method before submitting a withdrawal request.
19	Withdrawal amount is deducted from marketer balance immediately on request. If rejected by superadmin, the amount is refunded to the marketer's balance.

9. INSTALLATION
Backend
cd backend
npm install
node index.js
Frontend
cd frontend
npm install
npm run dev

10. WHAT WAS REMOVED vs PREVIOUS VERSION
Removed Feature	Reason / Replacement
affiliate_links table	No affiliate links in new model. Orders are direct submissions by marketers.
/go/:code tracking endpoint	No link tracking needed. Use orders for conversion tracking.
MyLinks.jsx page	Replaced by MyOrders.jsx.
ProductPage.jsx (client landing page)	Replaced by ProductDetail.jsx (for marketers) + SubmitOrder.jsx.
'Buy via WhatsApp' button	Replaced by structured Order Request form.
Manual commission entry by admin/supplier	Commissions are now auto-calculated on order confirmation.
admin role for commission management	Superadmin role manages platform fees and approves commissions.

20	Page Refresh Preservation — When a user refreshes the page, they must remain on the same page, not be redirected to the home page. Implement by: (1) Store the current path in localStorage as 'intendedPath' before redirecting to login when authentication is needed, (2) After successful login, check for 'intendedPath' in localStorage and redirect to that path instead of the default role-based path, (3) Clear 'intendedPath' from localStorage after successful redirect.

END OF SYSTEM PROMPT — Build every file in Section 4. Write complete working code. No TODO comments.
