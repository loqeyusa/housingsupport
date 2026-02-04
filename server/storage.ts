import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  counties,
  serviceTypes,
  serviceStatuses,
  paymentMethods,
  expenseCategories,
  clients,
  clientHistories,
  clientHousings,
  clientDocuments,
  clientMonths,
  housingSupports,
  rentPayments,
  lthPayments,
  expenses,
  poolFunds,
  auditLogs,
  activities,
  type User,
  type InsertUser,
  type County,
  type InsertCounty,
  type ServiceType,
  type InsertServiceType,
  type ServiceStatus,
  type InsertServiceStatus,
  type PaymentMethod,
  type InsertPaymentMethod,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Client,
  type InsertClient,
  type ClientHistory,
  type InsertClientHistory,
  type ClientHousing,
  type InsertClientHousing,
  type ClientDocument,
  type InsertClientDocument,
  type ClientMonth,
  type InsertClientMonth,
  type HousingSupport,
  type InsertHousingSupport,
  type RentPayment,
  type InsertRentPayment,
  type LthPayment,
  type InsertLthPayment,
  type Expense,
  type InsertExpense,
  type PoolFund,
  type InsertPoolFund,
  type AuditLog,
  type InsertAuditLog,
  type Activity,
  type InsertActivity,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;

  // Counties
  getCounty(id: string): Promise<County | undefined>;
  getCounties(): Promise<County[]>;
  createCounty(county: InsertCounty): Promise<County>;
  updateCounty(id: string, county: Partial<InsertCounty>): Promise<County | undefined>;

  // Service Types
  getServiceType(id: string): Promise<ServiceType | undefined>;
  getServiceTypes(): Promise<ServiceType[]>;
  createServiceType(serviceType: InsertServiceType): Promise<ServiceType>;
  updateServiceType(id: string, serviceType: Partial<InsertServiceType>): Promise<ServiceType | undefined>;

  // Service Statuses
  getServiceStatus(id: string): Promise<ServiceStatus | undefined>;
  getServiceStatuses(): Promise<ServiceStatus[]>;
  createServiceStatus(serviceStatus: InsertServiceStatus): Promise<ServiceStatus>;
  updateServiceStatus(id: string, serviceStatus: Partial<InsertServiceStatus>): Promise<ServiceStatus | undefined>;

  // Payment Methods
  getPaymentMethod(id: string): Promise<PaymentMethod | undefined>;
  getPaymentMethods(): Promise<PaymentMethod[]>;
  createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, paymentMethod: Partial<InsertPaymentMethod>): Promise<PaymentMethod | undefined>;

  // Expense Categories
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  createExpenseCategory(expenseCategory: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, expenseCategory: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;

  // Clients
  getClient(id: string): Promise<Client | undefined>;
  getClients(): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;

  // Client History
  getClientHistories(clientId: string): Promise<ClientHistory[]>;
  createClientHistory(history: InsertClientHistory): Promise<ClientHistory>;

  // Client Housing
  getClientHousing(clientId: string): Promise<ClientHousing | undefined>;
  createClientHousing(housing: InsertClientHousing): Promise<ClientHousing>;
  updateClientHousing(id: string, housing: Partial<InsertClientHousing>): Promise<ClientHousing | undefined>;

  // Client Documents
  getClientDocuments(clientId: string): Promise<ClientDocument[]>;
  createClientDocument(document: InsertClientDocument): Promise<ClientDocument>;
  deleteClientDocument(id: string): Promise<void>;

  // Client Months
  getClientMonth(id: string): Promise<ClientMonth | undefined>;
  getClientMonths(clientId: string): Promise<ClientMonth[]>;
  getClientMonthByPeriod(clientId: string, year: number, month: number): Promise<ClientMonth | undefined>;
  createClientMonth(clientMonth: InsertClientMonth): Promise<ClientMonth>;
  updateClientMonth(id: string, clientMonth: Partial<InsertClientMonth>): Promise<ClientMonth | undefined>;

  // Housing Supports
  getHousingSupport(clientMonthId: string): Promise<HousingSupport | undefined>;
  createHousingSupport(support: InsertHousingSupport): Promise<HousingSupport>;
  updateHousingSupport(id: string, support: Partial<InsertHousingSupport>): Promise<HousingSupport | undefined>;

  // Rent Payments
  getRentPayment(clientMonthId: string): Promise<RentPayment | undefined>;
  createRentPayment(payment: InsertRentPayment): Promise<RentPayment>;
  updateRentPayment(id: string, payment: Partial<InsertRentPayment>): Promise<RentPayment | undefined>;

  // LTH Payments
  getLthPayments(clientMonthId: string): Promise<LthPayment[]>;
  createLthPayment(payment: InsertLthPayment): Promise<LthPayment>;
  updateLthPayment(id: string, payment: Partial<InsertLthPayment>): Promise<LthPayment | undefined>;
  deleteLthPayment(id: string): Promise<void>;

  // Expenses
  getExpenses(clientMonthId: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<void>;

  // Pool Funds
  getPoolFund(clientMonthId: string): Promise<PoolFund | undefined>;
  createPoolFund(poolFund: InsertPoolFund): Promise<PoolFund>;
  updatePoolFund(id: string, poolFund: Partial<InsertPoolFund>): Promise<PoolFund | undefined>;

  // Audit Logs
  getAuditLogs(entityId?: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Activities
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated;
  }

  // Counties
  async getCounty(id: string): Promise<County | undefined> {
    const [county] = await db.select().from(counties).where(eq(counties.id, id));
    return county;
  }

  async getCounties(): Promise<County[]> {
    return db.select().from(counties);
  }

  async createCounty(county: InsertCounty): Promise<County> {
    const [newCounty] = await db.insert(counties).values(county).returning();
    return newCounty;
  }

  async updateCounty(id: string, county: Partial<InsertCounty>): Promise<County | undefined> {
    const [updated] = await db.update(counties).set(county).where(eq(counties.id, id)).returning();
    return updated;
  }

  // Service Types
  async getServiceType(id: string): Promise<ServiceType | undefined> {
    const [serviceType] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
    return serviceType;
  }

  async getServiceTypes(): Promise<ServiceType[]> {
    return db.select().from(serviceTypes);
  }

  async createServiceType(serviceType: InsertServiceType): Promise<ServiceType> {
    const [newServiceType] = await db.insert(serviceTypes).values(serviceType).returning();
    return newServiceType;
  }

  async updateServiceType(id: string, serviceType: Partial<InsertServiceType>): Promise<ServiceType | undefined> {
    const [updated] = await db.update(serviceTypes).set(serviceType).where(eq(serviceTypes.id, id)).returning();
    return updated;
  }

  // Service Statuses
  async getServiceStatus(id: string): Promise<ServiceStatus | undefined> {
    const [status] = await db.select().from(serviceStatuses).where(eq(serviceStatuses.id, id));
    return status;
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    return db.select().from(serviceStatuses);
  }

  async createServiceStatus(serviceStatus: InsertServiceStatus): Promise<ServiceStatus> {
    const [newStatus] = await db.insert(serviceStatuses).values(serviceStatus).returning();
    return newStatus;
  }

  async updateServiceStatus(id: string, serviceStatus: Partial<InsertServiceStatus>): Promise<ServiceStatus | undefined> {
    const [updated] = await db.update(serviceStatuses).set(serviceStatus).where(eq(serviceStatuses.id, id)).returning();
    return updated;
  }

  // Payment Methods
  async getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
    const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
    return method;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    return db.select().from(paymentMethods);
  }

  async createPaymentMethod(paymentMethod: InsertPaymentMethod): Promise<PaymentMethod> {
    const [newMethod] = await db.insert(paymentMethods).values(paymentMethod).returning();
    return newMethod;
  }

  async updatePaymentMethod(id: string, paymentMethod: Partial<InsertPaymentMethod>): Promise<PaymentMethod | undefined> {
    const [updated] = await db.update(paymentMethods).set(paymentMethod).where(eq(paymentMethods.id, id)).returning();
    return updated;
  }

  // Expense Categories
  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    const [category] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
    return category;
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return db.select().from(expenseCategories);
  }

  async createExpenseCategory(expenseCategory: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [newCategory] = await db.insert(expenseCategories).values(expenseCategory).returning();
    return newCategory;
  }

  async updateExpenseCategory(id: string, expenseCategory: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const [updated] = await db.update(expenseCategories).set(expenseCategory).where(eq(expenseCategories.id, id)).returning();
    return updated;
  }

  // Clients
  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClients(): Promise<Client[]> {
    return db.select().from(clients);
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set(client).where(eq(clients.id, id)).returning();
    return updated;
  }

  // Client History
  async getClientHistories(clientId: string): Promise<ClientHistory[]> {
    return db.select().from(clientHistories).where(eq(clientHistories.clientId, clientId)).orderBy(desc(clientHistories.changedAt));
  }

  async createClientHistory(history: InsertClientHistory): Promise<ClientHistory> {
    const [newHistory] = await db.insert(clientHistories).values(history).returning();
    return newHistory;
  }

  // Client Housing
  async getClientHousing(clientId: string): Promise<ClientHousing | undefined> {
    const [housing] = await db.select().from(clientHousings).where(eq(clientHousings.clientId, clientId));
    return housing;
  }

  async createClientHousing(housing: InsertClientHousing): Promise<ClientHousing> {
    const [newHousing] = await db.insert(clientHousings).values(housing).returning();
    return newHousing;
  }

  async updateClientHousing(id: string, housing: Partial<InsertClientHousing>): Promise<ClientHousing | undefined> {
    const [updated] = await db.update(clientHousings).set(housing).where(eq(clientHousings.id, id)).returning();
    return updated;
  }

  // Client Documents
  async getClientDocuments(clientId: string): Promise<ClientDocument[]> {
    return db.select().from(clientDocuments).where(eq(clientDocuments.clientId, clientId));
  }

  async createClientDocument(document: InsertClientDocument): Promise<ClientDocument> {
    const [newDoc] = await db.insert(clientDocuments).values(document).returning();
    return newDoc;
  }

  async deleteClientDocument(id: string): Promise<void> {
    await db.delete(clientDocuments).where(eq(clientDocuments.id, id));
  }

  // Client Months
  async getClientMonth(id: string): Promise<ClientMonth | undefined> {
    const [month] = await db.select().from(clientMonths).where(eq(clientMonths.id, id));
    return month;
  }

  async getClientMonths(clientId: string): Promise<ClientMonth[]> {
    return db.select().from(clientMonths).where(eq(clientMonths.clientId, clientId));
  }

  async getClientMonthByPeriod(clientId: string, year: number, month: number): Promise<ClientMonth | undefined> {
    const [result] = await db.select().from(clientMonths).where(
      and(
        eq(clientMonths.clientId, clientId),
        eq(clientMonths.year, year),
        eq(clientMonths.month, month)
      )
    );
    return result;
  }

  async createClientMonth(clientMonth: InsertClientMonth): Promise<ClientMonth> {
    const [newMonth] = await db.insert(clientMonths).values(clientMonth).returning();
    return newMonth;
  }

  async updateClientMonth(id: string, clientMonth: Partial<InsertClientMonth>): Promise<ClientMonth | undefined> {
    const [updated] = await db.update(clientMonths).set(clientMonth).where(eq(clientMonths.id, id)).returning();
    return updated;
  }

  // Housing Supports
  async getHousingSupport(clientMonthId: string): Promise<HousingSupport | undefined> {
    const [support] = await db.select().from(housingSupports).where(eq(housingSupports.clientMonthId, clientMonthId));
    return support;
  }

  async createHousingSupport(support: InsertHousingSupport): Promise<HousingSupport> {
    const [newSupport] = await db.insert(housingSupports).values(support).returning();
    return newSupport;
  }

  async updateHousingSupport(id: string, support: Partial<InsertHousingSupport>): Promise<HousingSupport | undefined> {
    const [updated] = await db.update(housingSupports).set(support).where(eq(housingSupports.id, id)).returning();
    return updated;
  }

  // Rent Payments
  async getRentPayment(clientMonthId: string): Promise<RentPayment | undefined> {
    const [payment] = await db.select().from(rentPayments).where(eq(rentPayments.clientMonthId, clientMonthId));
    return payment;
  }

  async createRentPayment(payment: InsertRentPayment): Promise<RentPayment> {
    const [newPayment] = await db.insert(rentPayments).values(payment).returning();
    return newPayment;
  }

  async updateRentPayment(id: string, payment: Partial<InsertRentPayment>): Promise<RentPayment | undefined> {
    const [updated] = await db.update(rentPayments).set(payment).where(eq(rentPayments.id, id)).returning();
    return updated;
  }

  // LTH Payments
  async getLthPayments(clientMonthId: string): Promise<LthPayment[]> {
    return db.select().from(lthPayments).where(eq(lthPayments.clientMonthId, clientMonthId));
  }

  async createLthPayment(payment: InsertLthPayment): Promise<LthPayment> {
    const [newPayment] = await db.insert(lthPayments).values(payment).returning();
    return newPayment;
  }

  async updateLthPayment(id: string, payment: Partial<InsertLthPayment>): Promise<LthPayment | undefined> {
    const [updated] = await db.update(lthPayments).set(payment).where(eq(lthPayments.id, id)).returning();
    return updated;
  }

  async deleteLthPayment(id: string): Promise<void> {
    await db.delete(lthPayments).where(eq(lthPayments.id, id));
  }

  // Expenses
  async getExpenses(clientMonthId: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.clientMonthId, clientMonthId));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [updated] = await db.update(expenses).set(expense).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async deleteExpense(id: string): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  // Pool Funds
  async getPoolFund(clientMonthId: string): Promise<PoolFund | undefined> {
    const [fund] = await db.select().from(poolFunds).where(eq(poolFunds.clientMonthId, clientMonthId));
    return fund;
  }

  async createPoolFund(poolFund: InsertPoolFund): Promise<PoolFund> {
    const [newFund] = await db.insert(poolFunds).values(poolFund).returning();
    return newFund;
  }

  async updatePoolFund(id: string, poolFund: Partial<InsertPoolFund>): Promise<PoolFund | undefined> {
    const [updated] = await db.update(poolFunds).set(poolFund).where(eq(poolFunds.id, id)).returning();
    return updated;
  }

  // Audit Logs
  async getAuditLogs(entityId?: string): Promise<AuditLog[]> {
    if (entityId) {
      return db.select().from(auditLogs).where(eq(auditLogs.entityId, entityId)).orderBy(desc(auditLogs.createdAt));
    }
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  // Activities
  async getActivities(limit: number = 50): Promise<Activity[]> {
    return db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db.insert(activities).values(activity).returning();
    return newActivity;
  }
}

export const storage = new DatabaseStorage();
