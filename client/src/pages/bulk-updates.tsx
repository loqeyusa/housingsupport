import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import type { Client, County } from "@shared/schema";

type FinancialType = "housing_support" | "rent" | "expense" | "lth";

interface BulkUpdateData {
  year: number;
  month: number;
  financialType: FinancialType;
  amount: string;
  clientIds: string[];
  clientAmounts: Record<string, string>;
  useUniformAmount: boolean;
}

export default function BulkUpdatesPage() {
  const { toast } = useToast();
  const currentDate = new Date();
  
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [financialType, setFinancialType] = useState<FinancialType>("housing_support");
  const [selectionMode, setSelectionMode] = useState<"all" | "county" | "manual">("manual");
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [uniformAmount, setUniformAmount] = useState("");
  const [clientAmounts, setClientAmounts] = useState<Record<string, string>>({});
  const [useUniformAmount, setUseUniformAmount] = useState(true);

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: counties } = useQuery<County[]>({
    queryKey: ["/api/counties"],
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: BulkUpdateData) => {
      return apiRequest("POST", "/api/bulk-updates", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Bulk update completed",
        description: `Successfully updated ${data.updatedCount} records.`,
      });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Failed to process bulk update.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedClients(new Set());
    setUniformAmount("");
    setClientAmounts({});
  };

  const filteredClients = clients?.filter((client) => {
    if (selectionMode === "county" && selectedCounty) {
      return client.countyId === selectedCounty;
    }
    return true;
  });

  const handleSelectAll = () => {
    if (!filteredClients) return;
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const handleSelectClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleClientAmountChange = (clientId: string, amount: string) => {
    setClientAmounts((prev) => ({
      ...prev,
      [clientId]: amount,
    }));
  };

  const handleSubmit = () => {
    if (selectedClients.size === 0) {
      toast({
        title: "No clients selected",
        description: "Please select at least one client.",
        variant: "destructive",
      });
      return;
    }

    if (useUniformAmount && !uniformAmount) {
      toast({
        title: "Amount required",
        description: "Please enter an amount.",
        variant: "destructive",
      });
      return;
    }

    const data: BulkUpdateData = {
      year,
      month,
      financialType,
      amount: uniformAmount,
      clientIds: Array.from(selectedClients),
      clientAmounts,
      useUniformAmount,
    };

    bulkUpdateMutation.mutate(data);
  };

  const getCountyName = (countyId: string | null) => {
    if (!countyId) return "-";
    return counties?.find((c) => c.id === countyId)?.name || "-";
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const financialTypes = [
    { value: "housing_support", label: "Housing Support" },
    { value: "rent", label: "Rent Payment" },
    { value: "expense", label: "Expense" },
    { value: "lth", label: "LTH Payment" },
  ];

  return (
    <DashboardLayout title="Bulk Updates">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Financial Updates</h1>
          <p className="text-muted-foreground">
            Update financial records for multiple clients at once
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Update Settings</CardTitle>
              <CardDescription>Configure the bulk update parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select
                    value={year.toString()}
                    onValueChange={(v) => setYear(parseInt(v))}
                  >
                    <SelectTrigger data-testid="select-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <SelectItem key={y} value={y.toString()}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select
                    value={month.toString()}
                    onValueChange={(v) => setMonth(parseInt(v))}
                  >
                    <SelectTrigger data-testid="select-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value.toString()}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Financial Type</Label>
                <Select
                  value={financialType}
                  onValueChange={(v) => setFinancialType(v as FinancialType)}
                >
                  <SelectTrigger data-testid="select-financial-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {financialTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Client Selection</Label>
                <Select
                  value={selectionMode}
                  onValueChange={(v) => {
                    setSelectionMode(v as typeof selectionMode);
                    setSelectedClients(new Set());
                  }}
                >
                  <SelectTrigger data-testid="select-selection-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Selection</SelectItem>
                    <SelectItem value="county">By County</SelectItem>
                    <SelectItem value="all">All Clients</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectionMode === "county" && (
                <div className="space-y-2">
                  <Label>County</Label>
                  <Select
                    value={selectedCounty}
                    onValueChange={setSelectedCounty}
                  >
                    <SelectTrigger data-testid="select-county">
                      <SelectValue placeholder="Select county" />
                    </SelectTrigger>
                    <SelectContent>
                      {counties?.map((county) => (
                        <SelectItem key={county.id} value={county.id}>
                          {county.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="uniform"
                    checked={useUniformAmount}
                    onCheckedChange={(checked) => setUseUniformAmount(!!checked)}
                    data-testid="checkbox-uniform-amount"
                  />
                  <Label htmlFor="uniform">Same amount for all clients</Label>
                </div>

                {useUniformAmount && (
                  <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={uniformAmount}
                      onChange={(e) => setUniformAmount(e.target.value)}
                      data-testid="input-uniform-amount"
                    />
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={bulkUpdateMutation.isPending || selectedClients.size === 0}
                data-testid="button-submit-bulk-update"
              >
                {bulkUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Apply Update ({selectedClients.size} clients)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Select Clients</CardTitle>
                <CardDescription>
                  {selectedClients.size} of {filteredClients?.length || 0} clients selected
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {selectedClients.size === filteredClients?.length ? "Deselect All" : "Select All"}
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>County</TableHead>
                    {!useUniformAmount && <TableHead>Amount</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={() => handleSelectClient(client.id)}
                          data-testid={`checkbox-client-${client.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{client.fullName}</TableCell>
                      <TableCell>{getCountyName(client.countyId)}</TableCell>
                      {!useUniformAmount && (
                        <TableCell>
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="w-28"
                            value={clientAmounts[client.id] || ""}
                            onChange={(e) =>
                              handleClientAmountChange(client.id, e.target.value)
                            }
                            disabled={!selectedClients.has(client.id)}
                            data-testid={`input-amount-${client.id}`}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(!filteredClients || filteredClients.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No clients available
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
