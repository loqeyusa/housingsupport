import { storage } from "./storage";
import { hashPassword } from "./auth";
import { log } from "./index";

export async function seedDefaultData() {
  try {
    const existingUsers = await storage.getUsers();
    
    if (existingUsers.length === 0) {
      const hashedPassword = await hashPassword("admin123");
      
      await storage.createUser({
        name: "Super Admin",
        email: "admin@housing.local",
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
      });

      log("Created default super admin user: admin@housing.local / admin123");
    }

    const serviceStatuses = await storage.getServiceStatuses();
    if (serviceStatuses.length === 0) {
      await storage.createServiceStatus({ name: "Active" });
      await storage.createServiceStatus({ name: "Inactive" });
      await storage.createServiceStatus({ name: "Pending" });
      log("Created default service statuses");
    }

    const serviceTypes = await storage.getServiceTypes();
    if (serviceTypes.length === 0) {
      await storage.createServiceType({ name: "GRH", isActive: true });
      await storage.createServiceType({ name: "Housing Stabilization", isActive: true });
      await storage.createServiceType({ name: "LTH", isActive: true });
      log("Created default service types");
    }

    const counties = await storage.getCounties();
    if (counties.length === 0) {
      await storage.createCounty({ name: "Hennepin", isActive: true });
      await storage.createCounty({ name: "Ramsey", isActive: true });
      await storage.createCounty({ name: "Dakota", isActive: true });
      await storage.createCounty({ name: "Anoka", isActive: true });
      log("Created default counties");
    }

    const paymentMethods = await storage.getPaymentMethods();
    if (paymentMethods.length === 0) {
      await storage.createPaymentMethod({ name: "Check" });
      await storage.createPaymentMethod({ name: "ACH" });
      await storage.createPaymentMethod({ name: "Wire Transfer" });
      log("Created default payment methods");
    }

    const expenseCategories = await storage.getExpenseCategories();
    if (expenseCategories.length === 0) {
      await storage.createExpenseCategory({ name: "Security Deposit" });
      await storage.createExpenseCategory({ name: "Moving Expenses" });
      await storage.createExpenseCategory({ name: "Utilities" });
      await storage.createExpenseCategory({ name: "Other" });
      log("Created default expense categories");
    }

  } catch (error) {
    console.error("Seed error:", error);
  }
}
