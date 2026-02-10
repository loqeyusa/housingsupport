import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertUserSchema,
  insertCountySchema,
  insertServiceTypeSchema,
  insertServiceStatusSchema,
  insertPaymentMethodSchema,
  insertExpenseCategorySchema,
  insertClientSchema,
  insertClientHistorySchema,
  insertClientHousingSchema,
  insertClientDocumentSchema,
  insertClientMonthSchema,
  insertHousingSupportSchema,
  insertRentPaymentSchema,
  insertLthPaymentSchema,
  insertExpenseSchema,
  insertExpenseDocumentSchema,
  insertPoolFundSchema,
  insertAuditLogSchema,
  insertActivitySchema,
  loginSchema,
} from "@shared/schema";
import { 
  generateToken, 
  hashPassword, 
  comparePassword, 
  authMiddleware, 
  superAdminMiddleware,
  type AuthenticatedRequest 
} from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for document uploads
  registerObjectStorageRoutes(app);

  async function createAuditEntry(userId: string | null, actionType: string, entity: string, entityId: string | null, oldData: any, newData: any) {
    try {
      await storage.createAuditLog({
        userId,
        actionType,
        entity,
        entityId,
        oldData,
        newData,
      });
    } catch (e) {
      console.error("Failed to create audit log:", e);
    }
  }

  async function trackClientChange(clientId: string, fieldChanged: string, oldValue: string | null, newValue: string | null, changedBy: string | null) {
    try {
      await storage.createClientHistory({
        clientId,
        fieldChanged,
        oldValue,
        newValue,
        changedBy,
      });
    } catch (e) {
      console.error("Failed to create client history:", e);
    }
  }

  async function isServiceAgreementBlocked(clientId: string, userRole?: string): Promise<boolean> {
    if (userRole === "super_admin") return false;
    const docs = await storage.getClientDocuments(clientId);
    const saDoc = docs
      .filter(d => d.documentType === "SERVICE_AGREEMENT" && d.expiryDate)
      .sort((a, b) => new Date(b.expiryDate!).getTime() - new Date(a.expiryDate!).getTime())[0];
    if (!saDoc) return false;
    const expiry = new Date(saDoc.expiryDate!);
    if (expiry >= new Date()) return false;
    const client = await storage.getClient(clientId);
    if (client?.statusOverride === "active") return false;
    return true;
  }
  
  // ============================================
  // Authentication
  // ============================================
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid credentials format" });
      }

      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);

      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ============================================
  // Dashboard Metrics
  // ============================================
  app.get("/api/dashboard/metrics", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month, filter } = req.query;
      // filter can be: "all" | "year" | "month"
      
      const clients = await storage.getClients();
      
      let totalHousingSupport = 0;
      let totalRentPaid = 0;
      let totalExpenses = 0;
      let totalPoolFund = 0;
      let totalRemainingBalance = 0; // HS received but no deductions yet
      let poolContributorSet = new Set<string>();
      
      for (const client of clients) {
        const clientMonths = await storage.getClientMonths(client.id);
        
        // Filter client months based on filter type
        const relevantMonths = clientMonths.filter(cm => {
          if (filter === "month" && year && month) {
            return cm.year === parseInt(year as string) && cm.month === parseInt(month as string);
          } else if (filter === "year" && year) {
            return cm.year === parseInt(year as string);
          }
          // "all" or no filter - include everything
          return true;
        });
        
        for (const cm of relevantMonths) {
          // Get housing support
          const hs = await storage.getHousingSupport(cm.id);
          const hsAmount = hs ? parseFloat(hs.amount || "0") : 0;
          
          // Get rent payment
          const rent = await storage.getRentPayment(cm.id);
          const rentAmount = rent ? parseFloat(rent.paidAmount || "0") : 0;
          
          // Get expenses
          const expenses = await storage.getExpenses(cm.id);
          const expensesAmount = expenses && expenses.length > 0 
            ? expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0)
            : 0;
          
          // Add to totals
          totalHousingSupport += hsAmount;
          totalRentPaid += rentAmount;
          totalExpenses += expensesAmount;
          
          // Remaining Balance: Cumulative (HS - Rent - Expenses) for ALL months
          // This tracks the net balance across all months, regardless of deductions
          totalRemainingBalance += (hsAmount - rentAmount - expensesAmount);
          
          // Pool Fund: Only count if client has HS AND (rent OR expenses) for the month
          // Pool Fund = HS - (Rent + Expenses)
          if (hsAmount > 0 && (rentAmount > 0 || expensesAmount > 0)) {
            const monthPoolFund = hsAmount - (rentAmount + expensesAmount);
            totalPoolFund += monthPoolFund;
            poolContributorSet.add(client.id);
          }
        }
      }
      
      res.json({
        totalClients: clients.length,
        totalHousingSupport,
        totalRentPaid,
        totalExpenses,
        totalPoolFund,
        totalRemainingBalance,
        poolContributors: poolContributorSet.size,
      });
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // ============================================
  // Bulk Updates
  // ============================================
  
  // Get current financial amounts for clients for a specific period
  app.get("/api/bulk-updates/current-amounts", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month, financialType } = req.query;
      
      if (!year || !month || !financialType) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      const clients = await storage.getClients();
      const result: Record<string, { currentAmount: number; hasExistingData: boolean }> = {};
      
      for (const client of clients) {
        const clientMonth = await storage.getClientMonthByPeriod(
          client.id, 
          parseInt(year as string), 
          parseInt(month as string)
        );
        
        let currentAmount = 0;
        let hasExistingData = false;
        
        if (clientMonth) {
          switch (financialType) {
            case "housing_support":
              const hs = await storage.getHousingSupport(clientMonth.id);
              if (hs) {
                currentAmount = parseFloat(hs.amount) || 0;
                hasExistingData = true;
              }
              break;
            case "rent":
              const rent = await storage.getRentPayment(clientMonth.id);
              if (rent) {
                currentAmount = parseFloat(rent.paidAmount || "0") || 0;
                hasExistingData = true;
              }
              break;
            case "expense":
              const expenses = await storage.getExpenses(clientMonth.id);
              if (expenses && expenses.length > 0) {
                currentAmount = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
                hasExistingData = true;
              }
              break;
            case "lth":
              const lthPayments = await storage.getLthPayments(clientMonth.id);
              if (lthPayments && lthPayments.length > 0) {
                currentAmount = lthPayments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
                hasExistingData = true;
              }
              break;
          }
        }
        
        result[client.id] = { currentAmount, hasExistingData };
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching current amounts:", error);
      res.status(500).json({ error: "Failed to fetch current amounts" });
    }
  });
  
  app.post("/api/bulk-updates", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { year, month, financialType, amount, clientIds, clientAmounts, useUniformAmount } = req.body;

      if (!year || !month || !financialType || !clientIds || clientIds.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      let updatedCount = 0;

      for (const clientId of clientIds) {
        const clientAmount = useUniformAmount ? amount : clientAmounts[clientId];
        if (!clientAmount) continue;

        let clientMonth = await storage.getClientMonthByPeriod(clientId, year, month);
        
        if (!clientMonth) {
          clientMonth = await storage.createClientMonth({
            clientId,
            year,
            month,
            isLocked: false,
          });
        }

        if (clientMonth.isLocked && req.user?.role !== "super_admin") {
          continue;
        }

        switch (financialType) {
          case "housing_support":
            const existingHS = await storage.getHousingSupport(clientMonth.id);
            if (existingHS) {
              await storage.updateHousingSupport(existingHS.id, {
                amount: clientAmount,
                createdBy: req.user?.userId,
              });
            } else {
              await storage.createHousingSupport({
                clientMonthId: clientMonth.id,
                amount: clientAmount,
                createdBy: req.user?.userId,
              });
            }
            break;
          case "rent":
            const existingRent = await storage.getRentPayment(clientMonth.id);
            if (existingRent) {
              await storage.updateRentPayment(existingRent.id, {
                paidAmount: clientAmount,
              });
            } else {
              await storage.createRentPayment({
                clientMonthId: clientMonth.id,
                paidAmount: clientAmount,
              });
            }
            break;
          case "expense":
            await storage.createExpense({
              clientMonthId: clientMonth.id,
              amount: clientAmount,
            });
            break;
          case "lth":
            await storage.createLthPayment({
              clientMonthId: clientMonth.id,
              amount: clientAmount,
            });
            break;
        }

        updatedCount++;
      }

      await storage.createActivity({
        message: `Bulk ${financialType.replace("_", " ")} update for ${updatedCount} clients - ${new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
        relatedClientId: null,
      });

      await createAuditEntry(req.user?.userId || null, "create", financialType, null, null, {
        type: "bulk_update",
        financialType,
        year,
        month,
        updatedCount,
        clientIds,
      });

      res.json({ success: true, updatedCount });
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({ error: "Bulk update failed" });
    }
  });

  // ============================================
  // Reports
  // ============================================
  app.get("/api/reports", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const countyFilter = req.query.county as string;
      const serviceTypeFilter = req.query.serviceType as string;
      
      let clients = await storage.getClients();
      const counties = await storage.getCounties();
      const serviceTypes = await storage.getServiceTypes();
      
      // Apply filters
      if (countyFilter && countyFilter !== "all") {
        clients = clients.filter(c => c.countyId === countyFilter);
      }
      if (serviceTypeFilter && serviceTypeFilter !== "all") {
        clients = clients.filter(c => c.serviceTypeId === serviceTypeFilter);
      }

      const reportData = [];
      
      for (const client of clients) {
        const clientMonths = await storage.getClientMonths(client.id);
        const yearMonths = clientMonths.filter(cm => cm.year === year);
        
        let totalHousingSupport = 0;
        let totalRentPaid = 0;
        let totalExpenses = 0;
        
        for (const cm of yearMonths) {
          const hs = await storage.getHousingSupport(cm.id);
          if (hs) totalHousingSupport += parseFloat(hs.amount || "0");
          
          const rent = await storage.getRentPayment(cm.id);
          if (rent) totalRentPaid += parseFloat(rent.paidAmount || "0");
          
          const expenses = await storage.getExpenses(cm.id);
          if (expenses) {
            totalExpenses += expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0);
          }
        }
        
        // Pool Fund: Only count when HS AND (rent OR expenses)
        const hasRentOrExpenses = totalRentPaid > 0 || totalExpenses > 0;
        const poolFund = (totalHousingSupport > 0 && hasRentOrExpenses)
          ? totalHousingSupport - (totalRentPaid + totalExpenses)
          : 0;
        
        reportData.push({
          clientId: client.id,
          clientName: client.fullName,
          county: counties.find((c) => c.id === client.countyId)?.name || "-",
          serviceType: serviceTypes.find((t) => t.id === client.serviceTypeId)?.name || "-",
          totalHousingSupport,
          totalRentPaid,
          totalExpenses,
          poolFund,
        });
      }

      res.json(reportData);
    } catch (error) {
      console.error("Reports error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ============================================
  // Pool Fund Summary
  // ============================================
  app.get("/api/pool-fund-summary", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const year = parseInt(req.query.year as string);
      const month = req.query.month ? parseInt(req.query.month as string) : null;
      const countyId = req.query.countyId as string | undefined;

      if (isNaN(year)) {
        return res.status(400).json({ error: "Year is required" });
      }

      const allClients = await storage.getClients();
      const counties = await storage.getCounties();
      const contributions: any[] = [];
      
      const filteredClients = countyId ? allClients.filter(c => c.countyId === countyId) : allClients;
      
      let totalPoolFund = 0;
      let positiveContributors = 0;
      let negativeContributors = 0;

      for (const client of filteredClients) {
        // Get all client months for this year (or specific month)
        const clientMonths = await storage.getClientMonths(client.id);
        const relevantMonths = clientMonths.filter(cm => {
          if (month) {
            return cm.year === year && cm.month === month;
          }
          return cm.year === year;
        });

        if (relevantMonths.length === 0) continue;

        let clientHousingSupport = 0;
        let clientRentPaid = 0;
        let clientExpenses = 0;

        for (const cm of relevantMonths) {
          // Get housing support
          const hs = await storage.getHousingSupport(cm.id);
          if (hs) {
            clientHousingSupport += parseFloat(hs.amount || "0");
          }

          // Get rent payment
          const rent = await storage.getRentPayment(cm.id);
          if (rent) {
            clientRentPaid += parseFloat(rent.paidAmount || "0");
          }

          // Get expenses
          const expenses = await storage.getExpenses(cm.id);
          if (expenses) {
            clientExpenses += expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0);
          }
        }

        // Pool Fund Rule: Only count clients who have HS AND (rent OR expenses)
        // Pool Amount = HS - (Rent + Expenses)
        const hasHousingSupport = clientHousingSupport > 0;
        const hasRentOrExpenses = clientRentPaid > 0 || clientExpenses > 0;
        
        if (hasHousingSupport && hasRentOrExpenses) {
          const poolAmount = clientHousingSupport - (clientRentPaid + clientExpenses);
          
          contributions.push({
            clientId: client.id,
            clientName: client.fullName,
            county: counties.find(c => c.id === client.countyId)?.name || "-",
            housingSupport: clientHousingSupport,
            rentPaid: clientRentPaid,
            expenses: clientExpenses,
            poolAmount,
          });

          totalPoolFund += poolAmount;
          if (poolAmount >= 0) {
            positiveContributors++;
          } else {
            negativeContributors++;
          }
        }
      }

      // Sort by pool amount descending
      contributions.sort((a, b) => b.poolAmount - a.poolAmount);

      res.json({
        totalPoolFund,
        totalContributors: contributions.length,
        positiveContributors,
        negativeContributors,
        contributions,
      });
    } catch (error) {
      console.error("Pool fund summary error:", error);
      res.status(500).json({ error: "Failed to generate pool fund summary" });
    }
  });

  // ============================================
  // Client Yearly Financials (for grid view)
  // ============================================
  app.get("/api/clients/:clientId/yearly-financials", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.params.clientId as string;
      const year = parseInt(req.query.year as string);

      if (isNaN(year)) {
        return res.status(400).json({ error: "Year is required" });
      }

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const clientMonths = await storage.getClientMonths(clientId);
      const yearMonths = clientMonths.filter(cm => cm.year === year);

      // Build data for all 12 months
      const monthlyData: any[] = [];

      for (let month = 1; month <= 12; month++) {
        const clientMonth = yearMonths.find(cm => cm.month === month);
        
        let housingSupport = 0;
        let rentPaid = 0;
        let totalExpenses = 0;
        let clientMonthId = null;
        let isLocked = false;

        if (clientMonth) {
          clientMonthId = clientMonth.id;
          isLocked = clientMonth.isLocked || false;

          // Get housing support
          const hs = await storage.getHousingSupport(clientMonth.id);
          if (hs) {
            housingSupport = parseFloat(hs.amount || "0");
          }

          // Get rent payment
          const rent = await storage.getRentPayment(clientMonth.id);
          if (rent) {
            rentPaid = parseFloat(rent.paidAmount || "0");
          }

          // Get expenses
          const expenses = await storage.getExpenses(clientMonth.id);
          if (expenses && expenses.length > 0) {
            totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0);
          }
        }

        // Calculate remaining balance (HS - Rent - Expenses)
        const remainingBalance = housingSupport - rentPaid - totalExpenses;
        
        // Pool Fund: Only show when there is HS AND (rent OR expenses)
        // Pool Fund = HS - (Rent + Expenses)
        const hasRentOrExpenses = rentPaid > 0 || totalExpenses > 0;
        const poolFund = (housingSupport > 0 && hasRentOrExpenses) 
          ? housingSupport - (rentPaid + totalExpenses)
          : 0;

        monthlyData.push({
          month,
          year,
          clientMonthId,
          isLocked,
          housingSupport,
          rentPaid,
          totalExpenses,
          remainingBalance,
          poolFund,
          hasData: housingSupport > 0 || rentPaid > 0 || totalExpenses > 0,
        });
      }

      res.json({
        clientId,
        year,
        months: monthlyData,
      });
    } catch (error) {
      console.error("Client yearly financials error:", error);
      res.status(500).json({ error: "Failed to fetch yearly financials" });
    }
  });

  // ============================================
  // Users
  // ============================================
  app.get("/api/users", authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(({ password: _, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const existingUser = await storage.getUserByEmail(parsed.data.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
      
      const hashedPassword = await hashPassword(parsed.data.password);
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword,
      });
      
      const { password: _, ...userWithoutPassword } = user;

      await createAuditEntry(req.user?.userId || null, "create", "user", user.id, null, userWithoutPassword);

      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertUserSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const oldUser = await storage.getUser(req.params.id as string);
      const updateData = { ...parsed.data };
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const user = await storage.updateUser(req.params.id as string, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      const { password: _old, ...oldUserWithoutPassword } = oldUser || {} as any;
      await createAuditEntry(req.user?.userId || null, "update", "user", req.params.id as string, oldUserWithoutPassword, userWithoutPassword);

      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ============================================
  // Counties
  // ============================================
  app.get("/api/counties", async (req, res) => {
    try {
      const counties = await storage.getCounties();
      res.json(counties);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch counties" });
    }
  });

  app.get("/api/counties/:id", async (req, res) => {
    try {
      const county = await storage.getCounty(req.params.id);
      if (!county) {
        return res.status(404).json({ error: "County not found" });
      }
      res.json(county);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch county" });
    }
  });

  app.post("/api/counties", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertCountySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const county = await storage.createCounty(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "county", county.id, null, county);
      res.status(201).json(county);
    } catch (error) {
      res.status(500).json({ error: "Failed to create county" });
    }
  });

  app.patch("/api/counties/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertCountySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldCounty = await storage.getCounty(req.params.id);
      const county = await storage.updateCounty(req.params.id, parsed.data);
      if (!county) {
        return res.status(404).json({ error: "County not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "county", req.params.id, oldCounty, county);
      res.json(county);
    } catch (error) {
      res.status(500).json({ error: "Failed to update county" });
    }
  });

  // ============================================
  // Service Types
  // ============================================
  app.get("/api/service-types", async (req, res) => {
    try {
      const serviceTypes = await storage.getServiceTypes();
      res.json(serviceTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service types" });
    }
  });

  app.get("/api/service-types/:id", async (req, res) => {
    try {
      const serviceType = await storage.getServiceType(req.params.id);
      if (!serviceType) {
        return res.status(404).json({ error: "Service type not found" });
      }
      res.json(serviceType);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service type" });
    }
  });

  app.post("/api/service-types", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertServiceTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const serviceType = await storage.createServiceType(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "service_type", serviceType.id, null, serviceType);
      res.status(201).json(serviceType);
    } catch (error) {
      res.status(500).json({ error: "Failed to create service type" });
    }
  });

  app.patch("/api/service-types/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertServiceTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldServiceType = await storage.getServiceType(req.params.id);
      const serviceType = await storage.updateServiceType(req.params.id, parsed.data);
      if (!serviceType) {
        return res.status(404).json({ error: "Service type not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "service_type", req.params.id, oldServiceType, serviceType);
      res.json(serviceType);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service type" });
    }
  });

  // ============================================
  // Service Statuses
  // ============================================
  app.get("/api/service-statuses", async (req, res) => {
    try {
      const serviceStatuses = await storage.getServiceStatuses();
      res.json(serviceStatuses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service statuses" });
    }
  });

  app.get("/api/service-statuses/:id", async (req, res) => {
    try {
      const serviceStatus = await storage.getServiceStatus(req.params.id);
      if (!serviceStatus) {
        return res.status(404).json({ error: "Service status not found" });
      }
      res.json(serviceStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch service status" });
    }
  });

  app.post("/api/service-statuses", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertServiceStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const serviceStatus = await storage.createServiceStatus(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "service_status", serviceStatus.id, null, serviceStatus);
      res.status(201).json(serviceStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to create service status" });
    }
  });

  app.patch("/api/service-statuses/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertServiceStatusSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldServiceStatus = await storage.getServiceStatus(req.params.id);
      const serviceStatus = await storage.updateServiceStatus(req.params.id, parsed.data);
      if (!serviceStatus) {
        return res.status(404).json({ error: "Service status not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "service_status", req.params.id, oldServiceStatus, serviceStatus);
      res.json(serviceStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to update service status" });
    }
  });

  // ============================================
  // Payment Methods
  // ============================================
  app.get("/api/payment-methods", async (req, res) => {
    try {
      const paymentMethods = await storage.getPaymentMethods();
      res.json(paymentMethods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  app.get("/api/payment-methods/:id", async (req, res) => {
    try {
      const paymentMethod = await storage.getPaymentMethod(req.params.id);
      if (!paymentMethod) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment method" });
    }
  });

  app.post("/api/payment-methods", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertPaymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const paymentMethod = await storage.createPaymentMethod(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "payment_method", paymentMethod.id, null, paymentMethod);
      res.status(201).json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  app.patch("/api/payment-methods/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertPaymentMethodSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldPaymentMethod = await storage.getPaymentMethod(req.params.id);
      const paymentMethod = await storage.updatePaymentMethod(req.params.id, parsed.data);
      if (!paymentMethod) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "payment_method", req.params.id, oldPaymentMethod, paymentMethod);
      res.json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment method" });
    }
  });

  // ============================================
  // Expense Categories
  // ============================================
  app.get("/api/expense-categories", async (req, res) => {
    try {
      const expenseCategories = await storage.getExpenseCategories();
      res.json(expenseCategories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.get("/api/expense-categories/:id", async (req, res) => {
    try {
      const expenseCategory = await storage.getExpenseCategory(req.params.id);
      if (!expenseCategory) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json(expenseCategory);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense category" });
    }
  });

  app.post("/api/expense-categories", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertExpenseCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const expenseCategory = await storage.createExpenseCategory(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "expense_category", expenseCategory.id, null, expenseCategory);
      res.status(201).json(expenseCategory);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense category" });
    }
  });

  app.patch("/api/expense-categories/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertExpenseCategorySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldExpenseCategory = await storage.getExpenseCategory(req.params.id);
      const expenseCategory = await storage.updateExpenseCategory(req.params.id, parsed.data);
      if (!expenseCategory) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "expense_category", req.params.id, oldExpenseCategory, expenseCategory);
      res.json(expenseCategory);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense category" });
    }
  });

  // ============================================
  // Clients
  // ============================================
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      const enriched = await Promise.all(clients.map(async (client) => {
        const docs = await storage.getClientDocuments(client.id);
        const saDocs = docs.filter((d: any) => d.documentType === "SERVICE_AGREEMENT");
        let saStatus: string | null = null;
        let saExpiryDate: string | null = null;
        let saDaysRemaining: number | null = null;
        if (saDocs.length === 0) {
          saStatus = "suspended";
        } else {
          const saDocsWithExpiry = saDocs.filter((d: any) => d.expiryDate);
          if (saDocsWithExpiry.length === 0) {
            saStatus = "active";
          } else {
            const latestSa = saDocsWithExpiry.sort((a: any, b: any) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime())[0];
            const now = new Date();
            const expiry = new Date(latestSa.expiryDate!);
            const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            saExpiryDate = expiry.toISOString();
            saDaysRemaining = daysUntilExpiry;
            if (daysUntilExpiry < 0) saStatus = "expired";
            else saStatus = "active";
          }
        }
        if (client.statusOverride === "active" && saStatus !== "active") {
          saStatus = "override_active";
        }
        return { ...client, saStatus, saExpiryDate, saDaysRemaining };
      }));
      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { address, landlordName, landlordPhone, landlordEmail, landlordAddress, saStartDate, saExpiryDate, ...clientData } = req.body;
      const parsed = insertClientSchema.safeParse(clientData);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const client = await storage.createClient(parsed.data);
      
      if (address || landlordName || landlordPhone || landlordEmail || landlordAddress) {
        await storage.createClientHousing({
          clientId: client.id,
          address: address || null,
          landlordName: landlordName || null,
          landlordPhone: landlordPhone || null,
          landlordEmail: landlordEmail || null,
          landlordAddress: landlordAddress || null,
        });
      }

      if (saStartDate || saExpiryDate) {
        await storage.createClientDocument({
          clientId: client.id,
          documentType: "SERVICE_AGREEMENT",
          fileUrl: "",
          uploadedBy: null,
          startDate: saStartDate ? new Date(saStartDate) : null,
          expiryDate: saExpiryDate ? new Date(saExpiryDate) : null,
        });
      }
      
      // Create activity for new client
      await storage.createActivity({
        message: `New client added: ${client.fullName}`,
        relatedClientId: client.id,
      });

      await createAuditEntry(req.user?.userId || null, "create", "client", client.id, null, client);
      await trackClientChange(client.id, "Client Created", null, client.fullName, req.user?.userId || null);
      
      res.status(201).json(client);
    } catch (error) {
      console.error("Failed to create client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const { address, landlordName, landlordPhone, landlordEmail, landlordAddress, ...clientData } = req.body;
      if (clientData.statusOverride !== undefined || clientData.statusOverrideBy !== undefined || clientData.statusOverrideAt !== undefined) {
        if (req.user?.role !== "super_admin") {
          return res.status(403).json({ error: "Only super admins can modify status override" });
        }
      }
      const parsed = insertClientSchema.partial().safeParse(clientData);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const id = req.params.id as string;
      const oldClient = await storage.getClient(id);
      const client = await storage.updateClient(id, parsed.data);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      if (address !== undefined || landlordName !== undefined || landlordPhone !== undefined || landlordEmail !== undefined || landlordAddress !== undefined) {
        const existingHousing = await storage.getClientHousing(id);
        if (existingHousing) {
          await storage.updateClientHousing(existingHousing.id, {
            address: address ?? existingHousing.address,
            landlordName: landlordName ?? existingHousing.landlordName,
            landlordPhone: landlordPhone ?? existingHousing.landlordPhone,
            landlordEmail: landlordEmail ?? existingHousing.landlordEmail,
            landlordAddress: landlordAddress ?? existingHousing.landlordAddress,
          });
        } else {
          await storage.createClientHousing({
            clientId: id,
            address: address || null,
            landlordName: landlordName || null,
            landlordPhone: landlordPhone || null,
            landlordEmail: landlordEmail || null,
            landlordAddress: landlordAddress || null,
          });
        }
      }

      await createAuditEntry(req.user?.userId || null, "update", "client", id, oldClient, client);
      if (oldClient) {
        const fieldsToCompare: { key: keyof typeof oldClient; label: string }[] = [
          { key: "fullName", label: "Full Name" },
          { key: "phone", label: "Phone" },
          { key: "countyCaseNumber", label: "County Case Number" },
          { key: "countyId", label: "County" },
          { key: "serviceTypeId", label: "Service Type" },
          { key: "serviceStatusId", label: "Service Status" },
          { key: "isActive", label: "Active Status" },
          { key: "statusOverride", label: "Status Override" },
        ];
        for (const field of fieldsToCompare) {
          const oldVal = oldClient[field.key];
          const newVal = client[field.key];
          if (String(oldVal ?? "") !== String(newVal ?? "")) {
            await trackClientChange(id, field.label, String(oldVal ?? ""), String(newVal ?? ""), req.user?.userId || null);
          }
        }
      }
      
      res.json(client);
    } catch (error) {
      console.error("Failed to update client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // ============================================
  // Client History
  // ============================================
  app.get("/api/clients/:clientId/history", async (req, res) => {
    try {
      const histories = await storage.getClientHistories(req.params.clientId);
      res.json(histories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client history" });
    }
  });

  app.post("/api/client-histories", async (req, res) => {
    try {
      const parsed = insertClientHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const history = await storage.createClientHistory(parsed.data);
      res.status(201).json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client history" });
    }
  });

  // ============================================
  // Client Housing
  // ============================================
  app.get("/api/clients/:clientId/housing", async (req, res) => {
    try {
      const housing = await storage.getClientHousing(req.params.clientId);
      if (!housing) {
        return res.status(404).json({ error: "Client housing not found" });
      }
      res.json(housing);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client housing" });
    }
  });

  app.post("/api/client-housings", async (req, res) => {
    try {
      const parsed = insertClientHousingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const housing = await storage.createClientHousing(parsed.data);
      res.status(201).json(housing);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client housing" });
    }
  });

  app.patch("/api/client-housings/:id", async (req, res) => {
    try {
      const parsed = insertClientHousingSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const housing = await storage.updateClientHousing(req.params.id, parsed.data);
      if (!housing) {
        return res.status(404).json({ error: "Client housing not found" });
      }
      res.json(housing);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client housing" });
    }
  });

  // ============================================
  // Client Documents
  // ============================================
  app.get("/api/clients/:clientId/documents", async (req, res) => {
    try {
      const documents = await storage.getClientDocuments(req.params.clientId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client documents" });
    }
  });

  app.post("/api/client-documents", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const body = { ...req.body };
      if (body.startDate && typeof body.startDate === "string") {
        body.startDate = new Date(body.startDate);
      }
      if (body.expiryDate && typeof body.expiryDate === "string") {
        body.expiryDate = new Date(body.expiryDate);
      }
      const parsed = insertClientDocumentSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const document = await storage.createClientDocument(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "document", document.id, null, document);
      if (parsed.data.clientId) {
        await trackClientChange(parsed.data.clientId, "Document Uploaded", null, parsed.data.documentType, req.user?.userId || null);
      }
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client document" });
    }
  });

  app.delete("/api/client-documents/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      // Only super_admin can delete documents
      if (req.user?.role !== "super_admin") {
        return res.status(403).json({ error: "Only super admins can delete documents" });
      }
      const oldDoc = await storage.getClientDocumentById(req.params.id as string);
      await storage.deleteClientDocument(req.params.id as string);
      await createAuditEntry(req.user?.userId || null, "delete", "document", req.params.id as string, oldDoc, null);
      if (oldDoc?.clientId) {
        await trackClientChange(oldDoc.clientId, "Document Deleted", oldDoc.documentType, null, req.user?.userId || null);
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client document" });
    }
  });

  // ============================================
  // Client Months
  // ============================================
  app.get("/api/clients/:clientId/months", async (req, res) => {
    try {
      const months = await storage.getClientMonths(req.params.clientId);
      res.json(months);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client months" });
    }
  });

  app.get("/api/client-months/:id", async (req, res) => {
    try {
      const month = await storage.getClientMonth(req.params.id);
      if (!month) {
        return res.status(404).json({ error: "Client month not found" });
      }
      res.json(month);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client month" });
    }
  });

  app.post("/api/client-months", async (req, res) => {
    try {
      const parsed = insertClientMonthSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const month = await storage.createClientMonth(parsed.data);
      res.status(201).json(month);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client month" });
    }
  });

  app.patch("/api/client-months/:id", async (req, res) => {
    try {
      const parsed = insertClientMonthSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const month = await storage.updateClientMonth(req.params.id, parsed.data);
      if (!month) {
        return res.status(404).json({ error: "Client month not found" });
      }
      res.json(month);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client month" });
    }
  });

  // ============================================
  // Housing Supports
  // ============================================
  app.get("/api/client-months/:clientMonthId/housing-support", async (req, res) => {
    try {
      const support = await storage.getHousingSupport(req.params.clientMonthId);
      if (!support) {
        return res.status(404).json({ error: "Housing support not found" });
      }
      res.json(support);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch housing support" });
    }
  });

  app.post("/api/housing-supports", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertHousingSupportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      if (parsed.data.clientMonthId) {
        const cm = await storage.getClientMonth(parsed.data.clientMonthId);
        if (cm && await isServiceAgreementBlocked(cm.clientId, req.user?.role)) {
          return res.status(403).json({ error: "Financial edits blocked - service agreement expired" });
        }
      }
      const support = await storage.createHousingSupport(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "housing_support", support.id, null, support);
      if (parsed.data.clientMonthId) {
        const clientMonth = await storage.getClientMonth(parsed.data.clientMonthId);
        if (clientMonth) {
          await trackClientChange(clientMonth.clientId, "Housing Support Added", null, `$${parsed.data.amount}`, req.user?.userId || null);
        }
      }
      res.status(201).json(support);
    } catch (error) {
      res.status(500).json({ error: "Failed to create housing support" });
    }
  });

  app.patch("/api/housing-supports/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertHousingSupportSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldSupport = await storage.getHousingSupportById(req.params.id);
      const support = await storage.updateHousingSupport(req.params.id, parsed.data);
      if (!support) {
        return res.status(404).json({ error: "Housing support not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "housing_support", req.params.id, oldSupport, support);
      if (oldSupport) {
        const clientMonth = await storage.getClientMonth(oldSupport.clientMonthId);
        if (clientMonth && oldSupport.amount !== support.amount) {
          await trackClientChange(clientMonth.clientId, "Housing Support", `$${oldSupport.amount}`, `$${support.amount}`, req.user?.userId || null);
        }
      }
      res.json(support);
    } catch (error) {
      res.status(500).json({ error: "Failed to update housing support" });
    }
  });

  // ============================================
  // Rent Payments
  // ============================================
  app.get("/api/client-months/:clientMonthId/rent-payment", async (req, res) => {
    try {
      const payment = await storage.getRentPayment(req.params.clientMonthId);
      if (!payment) {
        return res.status(404).json({ error: "Rent payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rent payment" });
    }
  });

  app.post("/api/rent-payments", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertRentPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      if (parsed.data.clientMonthId) {
        const cm = await storage.getClientMonth(parsed.data.clientMonthId);
        if (cm && await isServiceAgreementBlocked(cm.clientId, req.user?.role)) {
          return res.status(403).json({ error: "Financial edits blocked - service agreement expired" });
        }
      }
      const payment = await storage.createRentPayment(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "rent_payment", payment.id, null, payment);
      if (parsed.data.clientMonthId) {
        const clientMonth = await storage.getClientMonth(parsed.data.clientMonthId);
        if (clientMonth) {
          await trackClientChange(clientMonth.clientId, "Rent Payment Added", null, `$${parsed.data.paidAmount || "0"}`, req.user?.userId || null);
        }
      }
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create rent payment" });
    }
  });

  app.patch("/api/rent-payments/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertRentPaymentSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldPayment = await storage.getRentPaymentById(req.params.id);
      const payment = await storage.updateRentPayment(req.params.id, parsed.data);
      if (!payment) {
        return res.status(404).json({ error: "Rent payment not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "rent_payment", req.params.id, oldPayment, payment);
      if (oldPayment) {
        const clientMonth = await storage.getClientMonth(oldPayment.clientMonthId);
        if (clientMonth && oldPayment.paidAmount !== payment.paidAmount) {
          await trackClientChange(clientMonth.clientId, "Rent Payment", `$${oldPayment.paidAmount || "0"}`, `$${payment.paidAmount || "0"}`, req.user?.userId || null);
        }
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rent payment" });
    }
  });

  // ============================================
  // LTH Payments
  // ============================================
  app.get("/api/client-months/:clientMonthId/lth-payments", async (req, res) => {
    try {
      const payments = await storage.getLthPayments(req.params.clientMonthId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch LTH payments" });
    }
  });

  app.post("/api/lth-payments", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertLthPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      if (parsed.data.clientMonthId) {
        const cm = await storage.getClientMonth(parsed.data.clientMonthId);
        if (cm && await isServiceAgreementBlocked(cm.clientId, req.user?.role)) {
          return res.status(403).json({ error: "Financial edits blocked - service agreement expired" });
        }
      }
      const payment = await storage.createLthPayment(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "lth_payment", payment.id, null, payment);
      if (parsed.data.clientMonthId) {
        const clientMonth = await storage.getClientMonth(parsed.data.clientMonthId);
        if (clientMonth) {
          await trackClientChange(clientMonth.clientId, "LTH Payment Added", null, `$${parsed.data.amount}`, req.user?.userId || null);
        }
      }
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create LTH payment" });
    }
  });

  app.patch("/api/lth-payments/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertLthPaymentSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldPayment = await storage.getLthPaymentById(req.params.id);
      const payment = await storage.updateLthPayment(req.params.id, parsed.data);
      if (!payment) {
        return res.status(404).json({ error: "LTH payment not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "lth_payment", req.params.id, oldPayment, payment);
      if (oldPayment) {
        const clientMonth = await storage.getClientMonth(oldPayment.clientMonthId);
        if (clientMonth && oldPayment.amount !== payment.amount) {
          await trackClientChange(clientMonth.clientId, "LTH Payment", `$${oldPayment.amount}`, `$${payment.amount}`, req.user?.userId || null);
        }
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update LTH payment" });
    }
  });

  app.delete("/api/lth-payments/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const oldPayment = await storage.getLthPaymentById(req.params.id);
      await storage.deleteLthPayment(req.params.id);
      await createAuditEntry(req.user?.userId || null, "delete", "lth_payment", req.params.id, oldPayment, null);
      if (oldPayment) {
        const clientMonth = await storage.getClientMonth(oldPayment.clientMonthId);
        if (clientMonth) {
          await trackClientChange(clientMonth.clientId, "LTH Payment Deleted", `$${oldPayment.amount}`, null, req.user?.userId || null);
        }
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete LTH payment" });
    }
  });

  // ============================================
  // Expenses
  // ============================================
  app.get("/api/client-months/:clientMonthId/expenses", async (req, res) => {
    try {
      const expenses = await storage.getExpenses(req.params.clientMonthId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      if (parsed.data.clientMonthId) {
        const cm = await storage.getClientMonth(parsed.data.clientMonthId);
        if (cm && await isServiceAgreementBlocked(cm.clientId, req.user?.role)) {
          return res.status(403).json({ error: "Financial edits blocked - service agreement expired" });
        }
      }
      const expense = await storage.createExpense(parsed.data);
      await createAuditEntry(req.user?.userId || null, "create", "expense", expense.id, null, expense);
      if (parsed.data.clientMonthId) {
        const clientMonth = await storage.getClientMonth(parsed.data.clientMonthId);
        if (clientMonth) {
          await trackClientChange(clientMonth.clientId, "Expense Added", null, `$${parsed.data.amount}`, req.user?.userId || null);
        }
      }
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertExpenseSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const oldExpense = await storage.getExpenseById(req.params.id);
      const expense = await storage.updateExpense(req.params.id, parsed.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      await createAuditEntry(req.user?.userId || null, "update", "expense", req.params.id, oldExpense, expense);
      if (oldExpense) {
        const clientMonth = await storage.getClientMonth(oldExpense.clientMonthId);
        if (clientMonth && oldExpense.amount !== expense.amount) {
          await trackClientChange(clientMonth.clientId, "Expense", `$${oldExpense.amount}`, `$${expense.amount}`, req.user?.userId || null);
        }
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const oldExpense = await storage.getExpenseById(req.params.id);
      await storage.deleteExpense(req.params.id);
      await createAuditEntry(req.user?.userId || null, "delete", "expense", req.params.id, oldExpense, null);
      if (oldExpense) {
        const clientMonth = await storage.getClientMonth(oldExpense.clientMonthId);
        if (clientMonth) {
          await trackClientChange(clientMonth.clientId, "Expense Deleted", `$${oldExpense.amount}`, null, req.user?.userId || null);
        }
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // ============================================
  // Expense Documents
  // ============================================
  app.get("/api/expenses/:expenseId/documents", async (req, res) => {
    try {
      const documents = await storage.getExpenseDocuments(req.params.expenseId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense documents" });
    }
  });

  app.get("/api/clients/:clientId/expense-documents", async (req, res) => {
    try {
      const documents = await storage.getExpenseDocumentsByClient(req.params.clientId as string);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense documents" });
    }
  });

  app.get("/api/client-months/:clientMonthId/expense-documents", async (req, res) => {
    try {
      const documents = await storage.getExpenseDocumentsByClientMonth(req.params.clientMonthId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense documents" });
    }
  });

  app.post("/api/expense-documents", async (req, res) => {
    try {
      const parsed = insertExpenseDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const document = await storage.createExpenseDocument(parsed.data);
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense document" });
    }
  });

  app.delete("/api/expense-documents/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteExpenseDocument(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense document" });
    }
  });

  // ============================================
  // Pool Funds
  // ============================================
  app.get("/api/client-months/:clientMonthId/pool-fund", async (req, res) => {
    try {
      const fund = await storage.getPoolFund(req.params.clientMonthId);
      if (!fund) {
        return res.status(404).json({ error: "Pool fund not found" });
      }
      res.json(fund);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pool fund" });
    }
  });

  app.post("/api/pool-funds", async (req, res) => {
    try {
      const parsed = insertPoolFundSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const fund = await storage.createPoolFund(parsed.data);
      res.status(201).json(fund);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pool fund" });
    }
  });

  app.patch("/api/pool-funds/:id", async (req, res) => {
    try {
      const parsed = insertPoolFundSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const fund = await storage.updatePoolFund(req.params.id, parsed.data);
      if (!fund) {
        return res.status(404).json({ error: "Pool fund not found" });
      }
      res.json(fund);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pool fund" });
    }
  });

  // ============================================
  // Audit Logs
  // ============================================
  app.get("/api/audit-logs", authMiddleware, superAdminMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const entityId = req.query.entityId as string | undefined;
      const logs = await storage.getAuditLogs(entityId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/audit-logs", async (req, res) => {
    try {
      const parsed = insertAuditLogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const log = await storage.createAuditLog(parsed.data);
      res.status(201).json(log);
    } catch (error) {
      res.status(500).json({ error: "Failed to create audit log" });
    }
  });

  // ============================================
  // Activities
  // ============================================
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const parsed = insertActivitySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const activity = await storage.createActivity(parsed.data);
      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create activity" });
    }
  });

  return httpServer;
}
