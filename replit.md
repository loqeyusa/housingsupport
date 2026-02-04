# Housing Support Management System

## Overview
A comprehensive housing support management system with JWT-based authentication, role-based access control, client management, monthly financial tracking, bulk updates, reporting, and audit logging.

## Authentication
- **JWT-based authentication** (not Replit Auth)
- **Two roles**: admin and super_admin
- **Default super admin**: admin@housing.local / admin123
- Super admins have additional access to User Management and Audit Logs

## Project Structure
```
├── client/                 # Frontend React application
│   └── src/
│       ├── components/     # Reusable UI components (layout/, ui/)
│       ├── pages/          # Page components (dashboard, clients, bulk-updates, reports, settings, users, audit-logs)
│       └── lib/            # Utility functions (auth.tsx, queryClient.ts)
├── server/                 # Backend Express server
│   ├── auth.ts            # JWT authentication & middleware
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API routes
│   ├── seed.ts            # Default data seeding
│   └── storage.ts         # Database storage layer
└── shared/                # Shared types and schemas
    └── schema.ts          # Drizzle ORM schemas
```

## Key Features
1. **Dashboard**: Metrics overview with time filters (All Time, By Year, By Month), county distribution, quick actions, recent activity
2. **Clients**: Full CRUD, filtering by county/service type/status, detailed profile with housing/documents/financials/history tabs
   - **Documents Tab**: In-page image viewer modal (no download, right-click disabled)
   - **Financials Tab**: Inline display of monthly data with month navigation (prev/next), summary cards for Housing Support, Rent, Expenses, Pool Fund
   - **Financials Grid View**: Yearly overview showing all 12 months with columns (HS, Rent, Expenses, Balance, Pool Fund), click to view details
3. **Bulk Updates**: Update housing support, rent, expenses, or LTH for multiple clients at once
   - Shows current amounts for each client
   - Warns before overwriting existing data with confirmation dialog
4. **Reports**: Filterable client reports with CSV export
5. **Pool Fund**: Dedicated page with:
   - Monthly/Yearly view toggle
   - Total pool fund, contributor count, positive/negative balance metrics
   - Per-client contribution breakdown table
6. **Settings**: Manage counties, service types, statuses, payment methods, expense categories
7. **User Management** (Super Admin): Create/manage admin users
8. **Audit Logs** (Super Admin): View all system changes with full detail

## Database Schema

### Users & Access Control
- **users** - Admin users (admin, super_admin roles)

### Reference Tables (Admin-managed)
- **counties** - Geographic counties
- **service_types** - Service types (GRH, HWS-I, LTH, etc.)
- **service_statuses** - Status values (Active, Inactive, Removed)
- **payment_methods** - Payment method options
- **expense_categories** - Expense category options

### Client Data
- **clients** - Core client identity (FK to county, service_type, service_status)
- **client_histories** - Audit trail for client field changes
- **client_housings** - Housing and landlord details per client
- **client_documents** - File attachments (HS_AWARD, LEASE, POLICY, OTHER)

### Financial Model (Month-scoped)
- **client_months** - Monthly container (year, month, is_locked)
- **housing_supports** - Housing support amounts (1 per month)
- **rent_payments** - Rent details (1 per month)
- **lth_payments** - LTH payments (many per month)
- **expenses** - Expenses (many per month)
- **pool_funds** - Calculated pool fund data

### Audit & Activity
- **audit_logs** - Raw, immutable audit trail (JSON old/new data)
- **activities** - Human-readable activity feed

## API Endpoints

### Reference Data
- `GET/POST/PATCH /api/users`
- `GET/POST/PATCH /api/counties`
- `GET/POST/PATCH /api/service-types`
- `GET/POST/PATCH /api/service-statuses`
- `GET/POST/PATCH /api/payment-methods`
- `GET/POST/PATCH /api/expense-categories`

### Clients
- `GET/POST/PATCH /api/clients`
- `GET /api/clients/:clientId/history`
- `GET /api/clients/:clientId/housing`
- `GET /api/clients/:clientId/documents`
- `GET /api/clients/:clientId/months`

### Financial Data
- `GET/POST/PATCH /api/client-months`
- `GET/POST/PATCH /api/housing-supports`
- `GET/POST/PATCH /api/rent-payments`
- `GET/POST/PATCH/DELETE /api/lth-payments`
- `GET/POST/PATCH/DELETE /api/expenses`
- `GET/POST/PATCH /api/pool-funds`

### Pool Fund Analytics
- `GET /api/pool-fund-summary` - Get pool fund metrics and contributions (params: year, month)

### Client Financials
- `GET /api/clients/:clientId/yearly-financials` - Get all 12 months of financial data for a client (params: year)

### Audit
- `GET/POST /api/audit-logs`
- `GET/POST /api/activities`

## Business Rules

### Pool Fund Formula
```
pool_amount = Housing Support - (Rent Paid + Total Expenses)
```
Negative values are allowed.

### Edit Window Logic
- Records editable until 30 days after month end
- After that: admins blocked, super_admins allowed
- Enforced via `ClientMonth.isLocked`

### Client Field Changes
When a client changes county or service type:
1. Update the foreign key
2. Write a history record to `client_histories`
3. Create an audit log entry

## Tech Stack
- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas

## Development Commands
- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database
