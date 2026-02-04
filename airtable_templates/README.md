# Airtable Structure for Housing Support Management System

This folder contains CSV templates for setting up your Airtable base to sync with the Housing Support Management System.

## Table Structure Overview

### Reference Tables (Lookup Tables)
1. **Counties** - Geographic counties
2. **Service Types** - Service types (GRH, HWS-I, LTH, etc.)
3. **Service Statuses** - Status values (Active, Inactive, Removed)
4. **Payment Methods** - Payment method options
5. **Expense Categories** - Expense category options

### Core Tables
6. **Clients** - Main client records with links to reference tables
7. **Client Housing** - Housing and landlord details (linked to Clients)
8. **Client Documents** - Document metadata (linked to Clients)

### Financial Tables
9. **Client Months** - Monthly financial container (linked to Clients)
10. **Housing Supports** - Housing support amounts (linked to Client Months)
11. **Rent Payments** - Rent payment details (linked to Client Months)
12. **LTH Payments** - LTH payments (linked to Client Months)
13. **Expenses** - Expenses (linked to Client Months, Expense Categories)

## Import Order

Import tables in this order to maintain relationships:
1. Reference tables first (Counties, Service Types, Service Statuses, Payment Methods, Expense Categories)
2. Clients
3. Client Housing, Client Documents
4. Client Months
5. Housing Supports, Rent Payments, LTH Payments, Expenses

## Field Type Mapping

| Database Type | Airtable Type |
|---------------|---------------|
| varchar/text | Single line text |
| numeric | Currency |
| boolean | Checkbox |
| timestamp | Date |
| Foreign Key | Link to another record |

## Linking Records in Airtable

For linked fields, use the display value (e.g., client name, county name) rather than IDs.
Airtable will automatically create the relationship when you set up the linked record field type.
