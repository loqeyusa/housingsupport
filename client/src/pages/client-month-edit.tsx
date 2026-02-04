import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Trash2, DollarSign, Home, Calendar, Lock, Unlock } from "lucide-react";
import { useState, useEffect } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ClientMonthEditPage() {
  const { clientId, monthId } = useParams<{ clientId: string; monthId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [housingSupport, setHousingSupport] = useState({ id: "", amount: "" });
  const [rentPayment, setRentPayment] = useState({ id: "", amount: "", paymentMethodId: "" });
  const [lthPayments, setLthPayments] = useState<Array<{ id: string; amount: string; description: string; isNew?: boolean }>>([]);
  const [expenses, setExpenses] = useState<Array<{ id: string; amount: string; categoryId: string; description: string; isNew?: boolean }>>([]);

  const { data: clientMonth, isLoading: monthLoading } = useQuery<{
    id: string;
    clientId: string;
    year: number;
    month: number;
    isLocked: boolean;
  }>({
    queryKey: ["/api/client-months", monthId],
  });

  const { data: client, isLoading: clientLoading } = useQuery<{
    id: string;
    fullName: string;
  }>({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
  });

  const { data: housingSupportData } = useQuery<{ id: string; amount: string } | null>({
    queryKey: ["/api/client-months", monthId, "housing-support"],
    enabled: !!monthId,
  });

  const { data: rentPaymentData } = useQuery<{ id: string; amount: string; paymentMethodId: string } | null>({
    queryKey: ["/api/client-months", monthId, "rent-payment"],
    enabled: !!monthId,
  });

  const { data: lthPaymentsData } = useQuery<Array<{ id: string; amount: string; description: string }>>({
    queryKey: ["/api/client-months", monthId, "lth-payments"],
    enabled: !!monthId,
  });

  const { data: expensesData } = useQuery<Array<{ id: string; amount: string; categoryId: string; description: string }>>({
    queryKey: ["/api/client-months", monthId, "expenses"],
    enabled: !!monthId,
  });

  const { data: paymentMethods } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/payment-methods"],
  });

  const { data: expenseCategories } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/expense-categories"],
  });

  useEffect(() => {
    if (housingSupportData) {
      setHousingSupport({ id: housingSupportData.id, amount: housingSupportData.amount || "" });
    }
  }, [housingSupportData]);

  useEffect(() => {
    if (rentPaymentData) {
      setRentPayment({
        id: rentPaymentData.id,
        amount: rentPaymentData.amount || "",
        paymentMethodId: rentPaymentData.paymentMethodId || "",
      });
    }
  }, [rentPaymentData]);

  useEffect(() => {
    if (lthPaymentsData) {
      setLthPayments(lthPaymentsData.map(p => ({ ...p, amount: p.amount || "" })));
    }
  }, [lthPaymentsData]);

  useEffect(() => {
    if (expensesData) {
      setExpenses(expensesData.map(e => ({ ...e, amount: e.amount || "" })));
    }
  }, [expensesData]);

  const isLocked = clientMonth?.isLocked && user?.role !== "super_admin";

  const updateHousingSupportMutation = useMutation({
    mutationFn: async (data: { id?: string; amount: string }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/housing-supports/${data.id}`, { amount: data.amount });
      } else {
        return apiRequest("POST", "/api/housing-supports", { clientMonthId: monthId, amount: data.amount });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "housing-support"] });
    },
  });

  const updateRentPaymentMutation = useMutation({
    mutationFn: async (data: { id?: string; amount: string; paymentMethodId: string }) => {
      if (data.id) {
        return apiRequest("PATCH", `/api/rent-payments/${data.id}`, { amount: data.amount, paymentMethodId: data.paymentMethodId });
      } else {
        return apiRequest("POST", "/api/rent-payments", { clientMonthId: monthId, amount: data.amount, paymentMethodId: data.paymentMethodId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "rent-payment"] });
    },
  });

  const createLthPaymentMutation = useMutation({
    mutationFn: async (data: { amount: string; description: string }) => {
      return apiRequest("POST", "/api/lth-payments", { clientMonthId: monthId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "lth-payments"] });
    },
  });

  const updateLthPaymentMutation = useMutation({
    mutationFn: async (data: { id: string; amount: string; description: string }) => {
      return apiRequest("PATCH", `/api/lth-payments/${data.id}`, { amount: data.amount, description: data.description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "lth-payments"] });
    },
  });

  const deleteLthPaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/lth-payments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "lth-payments"] });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: { amount: string; categoryId: string; description: string }) => {
      return apiRequest("POST", "/api/expenses", { clientMonthId: monthId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "expenses"] });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (data: { id: string; amount: string; categoryId: string; description: string }) => {
      return apiRequest("PATCH", `/api/expenses/${data.id}`, { amount: data.amount, categoryId: data.categoryId, description: data.description });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "expenses"] });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-months", monthId, "expenses"] });
    },
  });

  const handleSaveAll = async () => {
    try {
      if (housingSupport.amount) {
        await updateHousingSupportMutation.mutateAsync({ id: housingSupport.id || undefined, amount: housingSupport.amount });
      }

      if (rentPayment.amount && rentPayment.paymentMethodId) {
        await updateRentPaymentMutation.mutateAsync({
          id: rentPayment.id || undefined,
          amount: rentPayment.amount,
          paymentMethodId: rentPayment.paymentMethodId,
        });
      }

      for (const lth of lthPayments) {
        if (lth.isNew && lth.amount) {
          await createLthPaymentMutation.mutateAsync({ amount: lth.amount, description: lth.description });
        } else if (!lth.isNew && lth.id) {
          await updateLthPaymentMutation.mutateAsync({ id: lth.id, amount: lth.amount, description: lth.description });
        }
      }

      for (const expense of expenses) {
        if (expense.isNew && expense.amount && expense.categoryId) {
          await createExpenseMutation.mutateAsync({ amount: expense.amount, categoryId: expense.categoryId, description: expense.description });
        } else if (!expense.isNew && expense.id) {
          await updateExpenseMutation.mutateAsync({ id: expense.id, amount: expense.amount, categoryId: expense.categoryId, description: expense.description });
        }
      }

      toast({ title: "Success", description: "Financial data saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "yearly-financials"] });
      setLocation(`/clients/${clientId}`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to save financial data", variant: "destructive" });
    }
  };

  const addLthPayment = () => {
    setLthPayments([...lthPayments, { id: `new-${Date.now()}`, amount: "", description: "", isNew: true }]);
  };

  const removeLthPayment = async (index: number) => {
    const lth = lthPayments[index];
    if (!lth.isNew && lth.id) {
      await deleteLthPaymentMutation.mutateAsync(lth.id);
    }
    setLthPayments(lthPayments.filter((_, i) => i !== index));
  };

  const addExpense = () => {
    setExpenses([...expenses, { id: `new-${Date.now()}`, amount: "", categoryId: "", description: "", isNew: true }]);
  };

  const removeExpense = async (index: number) => {
    const expense = expenses[index];
    if (!expense.isNew && expense.id) {
      await deleteExpenseMutation.mutateAsync(expense.id);
    }
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  if (monthLoading || clientLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!clientMonth) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Month record not found</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href={`/clients/${clientId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Client
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" data-testid="button-back">
            <Link href={`/clients/${clientId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{MONTHS[clientMonth.month - 1]} {clientMonth.year}</h1>
            <p className="text-muted-foreground">{client?.fullName} - Financial Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {clientMonth.isLocked ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Unlock className="h-3 w-3" />
              Editable
            </Badge>
          )}
        </div>
      </div>

      {isLocked && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">
              This month is locked. Only super admins can make changes.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Housing Support
          </CardTitle>
          <CardDescription>Monthly housing support amount</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="housing-support">Amount</Label>
              <Input
                id="housing-support"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={housingSupport.amount}
                onChange={(e) => setHousingSupport({ ...housingSupport, amount: e.target.value })}
                disabled={isLocked}
                data-testid="input-housing-support"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="h-4 w-4" />
            Rent Payment
          </CardTitle>
          <CardDescription>Monthly rent payment details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rent-amount">Amount</Label>
              <Input
                id="rent-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={rentPayment.amount}
                onChange={(e) => setRentPayment({ ...rentPayment, amount: e.target.value })}
                disabled={isLocked}
                data-testid="input-rent-amount"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={rentPayment.paymentMethodId}
                onValueChange={(value) => setRentPayment({ ...rentPayment, paymentMethodId: value })}
                disabled={isLocked}
              >
                <SelectTrigger id="payment-method" data-testid="select-payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods?.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            LTH Payments
          </CardTitle>
          <CardDescription>Long-term housing payments for this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {lthPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No LTH payments for this month</p>
            ) : (
              lthPayments.map((lth, index) => (
                <div key={lth.id} className="flex gap-4 items-end">
                  <div className="flex-1 grid gap-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={lth.amount}
                      onChange={(e) => {
                        const updated = [...lthPayments];
                        updated[index].amount = e.target.value;
                        setLthPayments(updated);
                      }}
                      disabled={isLocked}
                      data-testid={`input-lth-amount-${index}`}
                    />
                  </div>
                  <div className="flex-1 grid gap-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Description"
                      value={lth.description}
                      onChange={(e) => {
                        const updated = [...lthPayments];
                        updated[index].description = e.target.value;
                        setLthPayments(updated);
                      }}
                      disabled={isLocked}
                      data-testid={`input-lth-description-${index}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLthPayment(index)}
                    disabled={isLocked}
                    data-testid={`button-remove-lth-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addLthPayment}
              disabled={isLocked}
              data-testid="button-add-lth"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add LTH Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Expenses
          </CardTitle>
          <CardDescription>Other expenses for this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses for this month</p>
            ) : (
              expenses.map((expense, index) => (
                <div key={expense.id} className="flex gap-4 items-end">
                  <div className="flex-1 grid gap-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expense.amount}
                      onChange={(e) => {
                        const updated = [...expenses];
                        updated[index].amount = e.target.value;
                        setExpenses(updated);
                      }}
                      disabled={isLocked}
                      data-testid={`input-expense-amount-${index}`}
                    />
                  </div>
                  <div className="flex-1 grid gap-2">
                    <Label>Category</Label>
                    <Select
                      value={expense.categoryId}
                      onValueChange={(value) => {
                        const updated = [...expenses];
                        updated[index].categoryId = value;
                        setExpenses(updated);
                      }}
                      disabled={isLocked}
                    >
                      <SelectTrigger data-testid={`select-expense-category-${index}`}>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseCategories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 grid gap-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Description"
                      value={expense.description}
                      onChange={(e) => {
                        const updated = [...expenses];
                        updated[index].description = e.target.value;
                        setExpenses(updated);
                      }}
                      disabled={isLocked}
                      data-testid={`input-expense-description-${index}`}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExpense(index)}
                    disabled={isLocked}
                    data-testid={`button-remove-expense-${index}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={addExpense}
              disabled={isLocked}
              data-testid="button-add-expense"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button asChild variant="outline">
          <Link href={`/clients/${clientId}`}>Cancel</Link>
        </Button>
        <Button onClick={handleSaveAll} disabled={isLocked} data-testid="button-save-financials">
          <Save className="mr-2 h-4 w-4" />
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
