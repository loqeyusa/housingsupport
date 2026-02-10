import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "super_admin"]);
export const documentTypeEnum = pgEnum("document_type", ["HS_AWARD", "LEASE", "POLICY", "OTHER", "SERVICE_AGREEMENT"]);

// ============================================
// 2.1 Users (admins only)
// ============================================
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("admin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================
// 2.2 Reference tables (admin-managed)
// ============================================

// County
export const counties = pgTable("counties", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertCountySchema = createInsertSchema(counties).omit({
  id: true,
});

export type InsertCounty = z.infer<typeof insertCountySchema>;
export type County = typeof counties.$inferSelect;

// ServiceType
export const serviceTypes = pgTable("service_types", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertServiceTypeSchema = createInsertSchema(serviceTypes).omit({
  id: true,
});

export type InsertServiceType = z.infer<typeof insertServiceTypeSchema>;
export type ServiceType = typeof serviceTypes.$inferSelect;

// ServiceStatus
export const serviceStatuses = pgTable("service_statuses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertServiceStatusSchema = createInsertSchema(serviceStatuses).omit({
  id: true,
});

export type InsertServiceStatus = z.infer<typeof insertServiceStatusSchema>;
export type ServiceStatus = typeof serviceStatuses.$inferSelect;

// PaymentMethod
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
});

export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

// ExpenseCategory
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
});

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

// ============================================
// 2.3 Client (core identity)
// ============================================
export const clients = pgTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  countyCaseNumber: text("county_case_number"),
  countyId: varchar("county_id", { length: 36 }).references(() => counties.id),
  serviceTypeId: varchar("service_type_id", { length: 36 }).references(() => serviceTypes.id),
  serviceStatusId: varchar("service_status_id", { length: 36 }).references(() => serviceStatuses.id),
  statusOverride: text("status_override"),
  statusOverrideBy: varchar("status_override_by", { length: 36 }).references(() => users.id),
  statusOverrideAt: timestamp("status_override_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ============================================
// 2.4 Client history (for corrections over time)
// ============================================
export const clientHistories = pgTable("client_histories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
  fieldChanged: text("field_changed").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: varchar("changed_by", { length: 36 }).references(() => users.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export const insertClientHistorySchema = createInsertSchema(clientHistories).omit({
  id: true,
  changedAt: true,
});

export type InsertClientHistory = z.infer<typeof insertClientHistorySchema>;
export type ClientHistory = typeof clientHistories.$inferSelect;

// ============================================
// 2.5 Housing & landlord details
// ============================================
export const clientHousings = pgTable("client_housings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
  address: text("address"),
  landlordName: text("landlord_name"),
  landlordPhone: text("landlord_phone"),
  landlordEmail: text("landlord_email"),
  landlordAddress: text("landlord_address"),
});

export const insertClientHousingSchema = createInsertSchema(clientHousings).omit({
  id: true,
});

export type InsertClientHousing = z.infer<typeof insertClientHousingSchema>;
export type ClientHousing = typeof clientHousings.$inferSelect;

// ============================================
// 2.6 Documents (file-based, auditable)
// ============================================
export const clientDocuments = pgTable("client_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
  documentType: documentTypeEnum("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  startDate: timestamp("start_date"),
  expiryDate: timestamp("expiry_date"),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertClientDocumentSchema = createInsertSchema(clientDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertClientDocument = z.infer<typeof insertClientDocumentSchema>;
export type ClientDocument = typeof clientDocuments.$inferSelect;

// ============================================
// 3. Financial model
// ============================================

// 3.1 Monthly financial header
export const clientMonths = pgTable("client_months", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
});

export const insertClientMonthSchema = createInsertSchema(clientMonths).omit({
  id: true,
});

export type InsertClientMonth = z.infer<typeof insertClientMonthSchema>;
export type ClientMonth = typeof clientMonths.$inferSelect;

// 3.2 Housing Support (1 per month)
export const housingSupports = pgTable("housing_supports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientMonthId: varchar("client_month_id", { length: 36 }).notNull().references(() => clientMonths.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  receivedDate: timestamp("received_date"),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHousingSupportSchema = createInsertSchema(housingSupports).omit({
  id: true,
  createdAt: true,
});

export type InsertHousingSupport = z.infer<typeof insertHousingSupportSchema>;
export type HousingSupport = typeof housingSupports.$inferSelect;

// 3.3 Rent (1 per month)
export const rentPayments = pgTable("rent_payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientMonthId: varchar("client_month_id", { length: 36 }).notNull().references(() => clientMonths.id),
  expectedAmount: numeric("expected_amount", { precision: 12, scale: 2 }),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }),
  paidDate: timestamp("paid_date"),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
});

export const insertRentPaymentSchema = createInsertSchema(rentPayments).omit({
  id: true,
});

export type InsertRentPayment = z.infer<typeof insertRentPaymentSchema>;
export type RentPayment = typeof rentPayments.$inferSelect;

// 3.4 LTH (many per month)
export const lthPayments = pgTable("lth_payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientMonthId: varchar("client_month_id", { length: 36 }).notNull().references(() => clientMonths.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  receivedDate: timestamp("received_date"),
});

export const insertLthPaymentSchema = createInsertSchema(lthPayments).omit({
  id: true,
});

export type InsertLthPayment = z.infer<typeof insertLthPaymentSchema>;
export type LthPayment = typeof lthPayments.$inferSelect;

// 3.5 Expenses (many per month)
export const expenses = pgTable("expenses", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientMonthId: varchar("client_month_id", { length: 36 }).notNull().references(() => clientMonths.id),
  categoryId: varchar("category_id", { length: 36 }).references(() => expenseCategories.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: timestamp("expense_date"),
  notes: text("notes"),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// 3.5b Expense Documents (proof of expense)
export const expenseDocuments = pgTable("expense_documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  expenseId: varchar("expense_id", { length: 36 }).notNull().references(() => expenses.id),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
  clientMonthId: varchar("client_month_id", { length: 36 }).notNull().references(() => clientMonths.id),
  fileUrl: text("file_url").notNull(),
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertExpenseDocumentSchema = createInsertSchema(expenseDocuments).omit({
  id: true,
  uploadedAt: true,
});

export type InsertExpenseDocument = z.infer<typeof insertExpenseDocumentSchema>;
export type ExpenseDocument = typeof expenseDocuments.$inferSelect;

// 3.6 Pool fund (derived but stored)
export const poolFunds = pgTable("pool_funds", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  clientMonthId: varchar("client_month_id", { length: 36 }).notNull().references(() => clientMonths.id),
  hsAmount: numeric("hs_amount", { precision: 12, scale: 2 }),
  rentAmount: numeric("rent_amount", { precision: 12, scale: 2 }),
  expenseAmount: numeric("expense_amount", { precision: 12, scale: 2 }),
  poolAmount: numeric("pool_amount", { precision: 12, scale: 2 }),
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
});

export const insertPoolFundSchema = createInsertSchema(poolFunds).omit({
  id: true,
  calculatedAt: true,
});

export type InsertPoolFund = z.infer<typeof insertPoolFundSchema>;
export type PoolFund = typeof poolFunds.$inferSelect;

// ============================================
// 4. Audit & activity tracking
// ============================================

// 4.1 Audit log (raw, immutable)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).references(() => users.id),
  actionType: text("action_type").notNull(),
  entity: text("entity").notNull(),
  entityId: varchar("entity_id", { length: 36 }),
  oldData: json("old_data"),
  newData: json("new_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// 4.2 Activity feed (human readable)
export const activities = pgTable("activities", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(),
  relatedClientId: varchar("related_client_id", { length: 36 }).references(() => clients.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
