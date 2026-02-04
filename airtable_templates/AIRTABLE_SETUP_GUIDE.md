# Airtable Setup Guide for Housing Support Management System

## Option 1: Normalized Structure (Multiple Tables)

This mirrors the database structure exactly. Best for complex queries and data integrity.

### Step 1: Create Reference Tables

Import these CSV files first:
- `01_counties.csv` → Table: "Counties"
- `02_service_types.csv` → Table: "Service Types"
- `03_service_statuses.csv` → Table: "Service Statuses"
- `04_payment_methods.csv` → Table: "Payment Methods"
- `05_expense_categories.csv` → Table: "Expense Categories"

### Step 2: Create Clients Table

Import `06_clients.csv` → Table: "Clients"

After import, convert these fields to Linked Records:
- County → Link to "Counties"
- Service Type → Link to "Service Types"
- Service Status → Link to "Service Statuses"

### Step 3: Create Related Tables

Import these files:
- `07_client_housing.csv` → Table: "Client Housing"
- `08_client_documents.csv` → Table: "Client Documents"

Convert "Client" field to Linked Record → Link to "Clients"

### Step 4: Create Financial Tables

Import `09_client_months.csv` → Table: "Client Months"
- Convert "Client" to Linked Record → Link to "Clients"

Then import:
- `10_housing_supports.csv` → Table: "Housing Supports"
- `11_rent_payments.csv` → Table: "Rent Payments"
- `12_lth_payments.csv` → Table: "LTH Payments"
- `13_expenses.csv` → Table: "Expenses"

For financial tables, you'll need to create a linking field that combines Client + Year + Month.

---

## Option 2: Flattened Structure (Single Table)

This is simpler for Airtable and easier to sync. Best for most use cases.

### Import Single Table

Import `MASTER_client_financials_view.csv` → Table: "Client Financials"

### Field Types to Set

| Field | Airtable Type |
|-------|---------------|
| Client Name | Single line text (Primary) |
| Phone | Phone number |
| County Case Number | Single line text |
| County | Single select |
| Service Type | Single select |
| Service Status | Single select |
| Address | Long text |
| Landlord Name | Single line text |
| Landlord Phone | Phone number |
| Year | Number (Integer) |
| Month | Number (Integer) |
| Housing Support | Currency |
| Rent Expected | Currency |
| Rent Paid | Currency |
| Rent Confirmed | Checkbox |
| Total LTH | Currency |
| Total Expenses | Currency |
| Remaining Balance | Formula: {Housing Support} - {Rent Paid} - {Total Expenses} |
| Pool Fund | Formula (with conditions) |
| Is Locked | Checkbox |

---

## Calculated Fields (Formulas)

### Remaining Balance
```
{Housing Support} - {Rent Paid} - {Total Expenses}
```

### Pool Fund
```
IF(
  AND({Housing Support} > 0, OR({Rent Paid} > 0, {Total Expenses} > 0)),
  {Housing Support} - {Rent Paid} - {Total Expenses},
  0
)
```

---

## Sync Configuration

When connecting Airtable to the Housing Support platform:

1. **API Key**: Store in Replit Secrets as `AIRTABLE_API_KEY`
2. **Base ID**: Store as `AIRTABLE_BASE_ID`
3. **Table Names**: Ensure exact match with Airtable table names

### Recommended Sync Flow

```
Airtable ←→ Housing Support Platform

On Airtable Change:
  - Webhook triggers update to platform database
  
On Platform Change:
  - API call updates Airtable records
  
Conflict Resolution:
  - Last write wins (timestamp-based)
  - Audit log captures both changes
```

---

## Views to Create in Airtable

### 1. Active Clients View
Filter: `{Service Status} = "Active"`

### 2. Monthly Summary View
Group by: Year, Month
Show: Sum of Housing Support, Rent Paid, Expenses, Pool Fund

### 3. Pool Fund Contributors View
Filter: `{Pool Fund} != 0`
Sort: Pool Fund (Descending)

### 4. Outstanding Balance View
Filter: `{Remaining Balance} > 0`

### 5. By County View
Group by: County
Show: Count of clients, Sum of financials
