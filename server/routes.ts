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
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const clients = await storage.getClients();
      
      res.json({
        totalClients: clients.length,
        totalHousingSupport: 0,
        totalRentPaid: 0,
        totalExpenses: 0,
        totalPoolFund: 0,
        poolContributors: 0,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // ============================================
  // Bulk Updates
  // ============================================
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

      res.json({ success: true, updatedCount });
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({ error: "Bulk update failed" });
    }
  });

  // ============================================
  // Reports
  // ============================================
  app.get("/api/reports", async (req, res) => {
    try {
      const clients = await storage.getClients();
      const counties = await storage.getCounties();
      const serviceTypes = await storage.getServiceTypes();

      const reportData = clients.map((client) => ({
        clientId: client.id,
        clientName: client.fullName,
        county: counties.find((c) => c.id === client.countyId)?.name || "-",
        serviceType: serviceTypes.find((t) => t.id === client.serviceTypeId)?.name || "-",
        totalHousingSupport: 0,
        totalRentPaid: 0,
        totalExpenses: 0,
        poolFund: 0,
      }));

      res.json(reportData);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate report" });
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
      
      const updateData = { ...parsed.data };
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const user = await storage.updateUser(req.params.id as string, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
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

  app.post("/api/counties", async (req, res) => {
    try {
      const parsed = insertCountySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const county = await storage.createCounty(parsed.data);
      res.status(201).json(county);
    } catch (error) {
      res.status(500).json({ error: "Failed to create county" });
    }
  });

  app.patch("/api/counties/:id", async (req, res) => {
    try {
      const parsed = insertCountySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const county = await storage.updateCounty(req.params.id, parsed.data);
      if (!county) {
        return res.status(404).json({ error: "County not found" });
      }
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

  app.post("/api/service-types", async (req, res) => {
    try {
      const parsed = insertServiceTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const serviceType = await storage.createServiceType(parsed.data);
      res.status(201).json(serviceType);
    } catch (error) {
      res.status(500).json({ error: "Failed to create service type" });
    }
  });

  app.patch("/api/service-types/:id", async (req, res) => {
    try {
      const parsed = insertServiceTypeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const serviceType = await storage.updateServiceType(req.params.id, parsed.data);
      if (!serviceType) {
        return res.status(404).json({ error: "Service type not found" });
      }
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

  app.post("/api/service-statuses", async (req, res) => {
    try {
      const parsed = insertServiceStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const serviceStatus = await storage.createServiceStatus(parsed.data);
      res.status(201).json(serviceStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to create service status" });
    }
  });

  app.patch("/api/service-statuses/:id", async (req, res) => {
    try {
      const parsed = insertServiceStatusSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const serviceStatus = await storage.updateServiceStatus(req.params.id, parsed.data);
      if (!serviceStatus) {
        return res.status(404).json({ error: "Service status not found" });
      }
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

  app.post("/api/payment-methods", async (req, res) => {
    try {
      const parsed = insertPaymentMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const paymentMethod = await storage.createPaymentMethod(parsed.data);
      res.status(201).json(paymentMethod);
    } catch (error) {
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  app.patch("/api/payment-methods/:id", async (req, res) => {
    try {
      const parsed = insertPaymentMethodSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const paymentMethod = await storage.updatePaymentMethod(req.params.id, parsed.data);
      if (!paymentMethod) {
        return res.status(404).json({ error: "Payment method not found" });
      }
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

  app.post("/api/expense-categories", async (req, res) => {
    try {
      const parsed = insertExpenseCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const expenseCategory = await storage.createExpenseCategory(parsed.data);
      res.status(201).json(expenseCategory);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense category" });
    }
  });

  app.patch("/api/expense-categories/:id", async (req, res) => {
    try {
      const parsed = insertExpenseCategorySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const expenseCategory = await storage.updateExpenseCategory(req.params.id, parsed.data);
      if (!expenseCategory) {
        return res.status(404).json({ error: "Expense category not found" });
      }
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
      res.json(clients);
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

  app.post("/api/clients", async (req, res) => {
    try {
      const { address, landlordName, landlordPhone, landlordAddress, ...clientData } = req.body;
      const parsed = insertClientSchema.safeParse(clientData);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const client = await storage.createClient(parsed.data);
      
      // Create housing record if any housing data provided
      if (address || landlordName || landlordPhone || landlordAddress) {
        await storage.createClientHousing({
          clientId: client.id,
          address: address || null,
          landlordName: landlordName || null,
          landlordPhone: landlordPhone || null,
          landlordAddress: landlordAddress || null,
        });
      }
      
      // Create activity for new client
      await storage.createActivity({
        message: `New client added: ${client.fullName}`,
        relatedClientId: client.id,
      });
      
      res.status(201).json(client);
    } catch (error) {
      console.error("Failed to create client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const { address, landlordName, landlordPhone, landlordAddress, ...clientData } = req.body;
      const parsed = insertClientSchema.partial().safeParse(clientData);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const client = await storage.updateClient(req.params.id, parsed.data);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      
      // Update or create housing record
      if (address !== undefined || landlordName !== undefined || landlordPhone !== undefined || landlordAddress !== undefined) {
        const existingHousing = await storage.getClientHousing(req.params.id);
        if (existingHousing) {
          await storage.updateClientHousing(existingHousing.id, {
            address: address ?? existingHousing.address,
            landlordName: landlordName ?? existingHousing.landlordName,
            landlordPhone: landlordPhone ?? existingHousing.landlordPhone,
            landlordAddress: landlordAddress ?? existingHousing.landlordAddress,
          });
        } else {
          await storage.createClientHousing({
            clientId: req.params.id,
            address: address || null,
            landlordName: landlordName || null,
            landlordPhone: landlordPhone || null,
            landlordAddress: landlordAddress || null,
          });
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

  app.post("/api/client-documents", async (req, res) => {
    try {
      const parsed = insertClientDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const document = await storage.createClientDocument(parsed.data);
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client document" });
    }
  });

  app.delete("/api/client-documents/:id", async (req, res) => {
    try {
      await storage.deleteClientDocument(req.params.id);
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

  app.post("/api/housing-supports", async (req, res) => {
    try {
      const parsed = insertHousingSupportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const support = await storage.createHousingSupport(parsed.data);
      res.status(201).json(support);
    } catch (error) {
      res.status(500).json({ error: "Failed to create housing support" });
    }
  });

  app.patch("/api/housing-supports/:id", async (req, res) => {
    try {
      const parsed = insertHousingSupportSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const support = await storage.updateHousingSupport(req.params.id, parsed.data);
      if (!support) {
        return res.status(404).json({ error: "Housing support not found" });
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

  app.post("/api/rent-payments", async (req, res) => {
    try {
      const parsed = insertRentPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const payment = await storage.createRentPayment(parsed.data);
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create rent payment" });
    }
  });

  app.patch("/api/rent-payments/:id", async (req, res) => {
    try {
      const parsed = insertRentPaymentSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const payment = await storage.updateRentPayment(req.params.id, parsed.data);
      if (!payment) {
        return res.status(404).json({ error: "Rent payment not found" });
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

  app.post("/api/lth-payments", async (req, res) => {
    try {
      const parsed = insertLthPaymentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const payment = await storage.createLthPayment(parsed.data);
      res.status(201).json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to create LTH payment" });
    }
  });

  app.patch("/api/lth-payments/:id", async (req, res) => {
    try {
      const parsed = insertLthPaymentSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const payment = await storage.updateLthPayment(req.params.id, parsed.data);
      if (!payment) {
        return res.status(404).json({ error: "LTH payment not found" });
      }
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update LTH payment" });
    }
  });

  app.delete("/api/lth-payments/:id", async (req, res) => {
    try {
      await storage.deleteLthPayment(req.params.id);
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

  app.post("/api/expenses", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const expense = await storage.createExpense(parsed.data);
      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const parsed = insertExpenseSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const expense = await storage.updateExpense(req.params.id, parsed.data);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      await storage.deleteExpense(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
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
