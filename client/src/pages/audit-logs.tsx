import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Search, Eye, Filter, ArrowRight, Plus, Minus } from "lucide-react";
import type { AuditLog, User } from "@shared/schema";

export default function AuditLogsPage() {
  const [userFilter, setUserFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: auditLogs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    return users?.find((u) => u.id === userId)?.name || "Unknown";
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action.toUpperCase()) {
      case "CREATE":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const uniqueEntities = [...new Set(auditLogs?.map((log) => log.entity) || [])];
  const uniqueActions = [...new Set(auditLogs?.map((log) => log.actionType) || [])];

  const getLogClientName = (log: AuditLog): string | null => {
    const data = (log.newData || log.oldData) as Record<string, unknown> | null;
    if (!data) return null;
    return (data.clientName as string) || null;
  };

  const filteredLogs = auditLogs?.filter((log) => {
    const matchesUser = userFilter === "all" || log.userId === userFilter;
    const matchesEntity = entityFilter === "all" || log.entity === entityFilter;
    const matchesAction = actionFilter === "all" || log.actionType === actionFilter;
    const clientName = getLogClientName(log);
    const matchesSearch =
      !search ||
      log.entity.toLowerCase().includes(search.toLowerCase()) ||
      log.actionType.toLowerCase().includes(search.toLowerCase()) ||
      (log.entityId && log.entityId.includes(search)) ||
      (clientName && clientName.toLowerCase().includes(search.toLowerCase()));

    return matchesUser && matchesEntity && matchesAction && matchesSearch;
  });

  const FIELD_LABELS: Record<string, string> = {
    id: "ID",
    clientMonthId: "Month",
    categoryId: "Category",
    amount: "Amount",
    expenseDate: "Date",
    notes: "Notes",
    fullName: "Full Name",
    phone: "Phone",
    countyCaseNumber: "County Case Number",
    countyId: "County",
    serviceTypeId: "Service Type",
    serviceStatusId: "Service Status",
    isActive: "Active",
    statusOverride: "Status Override",
    statusOverrideBy: "Override By",
    statusOverrideAt: "Override At",
    createdAt: "Created At",
    address: "Address",
    landlordName: "Landlord Name",
    landlordPhone: "Landlord Phone",
    landlordEmail: "Landlord Email",
    landlordAddress: "Landlord Address",
    documentType: "Document Type",
    fileUrl: "File URL",
    uploadedBy: "Uploaded By",
    startDate: "Start Date",
    expiryDate: "Expiry Date",
    name: "Name",
    email: "Email",
    role: "Role",
    paymentMethodId: "Payment Method",
    rentAmount: "Rent Amount",
    paymentDate: "Payment Date",
    year: "Year",
    month: "Month",
    isLocked: "Locked",
    clientId: "Client",
    financialType: "Financial Type",
    monthLabel: "Period",
    paidAmount: "Paid Amount",
    type: "Type",
  };

  const HIDDEN_FIELDS = new Set(["id", "clientMonthId", "password", "clientId", "clientName"]);

  const getEntityLabel = (entity: string): string => {
    const labels: Record<string, string> = {
      client: "Client",
      housing_support: "Housing Support",
      rent_payment: "Rent Payment",
      lth_payment: "LTH Payment",
      expense: "Expense",
      document: "Document",
      bulk_update: "Bulk Update",
      user: "User",
      county: "County",
      service_type: "Service Type",
      service_status: "Service Status",
      payment_method: "Payment Method",
      expense_category: "Expense Category",
    };
    return labels[entity] || entity;
  };

  const formatFieldValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return "-";
    if (key === "amount" || key === "rentAmount" || key === "paidAmount") return `$${value}`;
    if (key === "isActive" || key === "isLocked") return value ? "Yes" : "No";
    if (key === "financialType") {
      const typeLabels: Record<string, string> = {
        housing_support: "Housing Support",
        rent: "Rent",
        expense: "Expense",
        lth: "LTH",
      };
      return typeLabels[String(value)] || String(value);
    }
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleDateString();
    }
    return String(value);
  };

  const getChangedFields = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => {
    if (!oldData && !newData) return [];
    const allData = newData || oldData || {};
    const keys = Object.keys(allData).filter(k => !HIDDEN_FIELDS.has(k));
    
    if (!oldData) {
      return keys.map(k => ({ field: k, label: FIELD_LABELS[k] || k, oldVal: null, newVal: allData[k], changed: true }));
    }
    if (!newData) {
      return keys.map(k => ({ field: k, label: FIELD_LABELS[k] || k, oldVal: allData[k], newVal: null, changed: true }));
    }
    
    return keys.map(k => ({
      field: k,
      label: FIELD_LABELS[k] || k,
      oldVal: oldData[k],
      newVal: newData[k],
      changed: String(oldData[k] ?? "") !== String(newData[k] ?? ""),
    }));
  };

  return (
    <DashboardLayout title="Audit Logs">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">
            View all system changes and administrative actions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-logs"
                />
              </div>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger data-testid="select-user-filter">
                  <SelectValue placeholder="Filter by User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger data-testid="select-entity-filter">
                  <SelectValue placeholder="Filter by Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {uniqueEntities.map((entity) => (
                    <SelectItem key={entity} value={entity}>
                      {entity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger data-testid="select-action-filter">
                  <SelectValue placeholder="Filter by Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>
              {filteredLogs?.length || 0} log entries
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs?.map((log) => (
                    <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{getUserName(log.userId)}</TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.actionType) as "default" | "secondary" | "destructive" | "outline"}>
                          {log.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{getEntityLabel(log.entity)}</TableCell>
                      <TableCell className="text-sm">
                        {getLogClientName(log) || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Audit Log Details</DialogTitle>
                              <DialogDescription>
                                {log.actionType} on {getEntityLabel(log.entity)} by {getUserName(log.userId)}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <Label className="text-muted-foreground">Timestamp</Label>
                                  <p>{new Date(log.createdAt).toLocaleString()}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Admin</Label>
                                  <p>{getUserName(log.userId)}</p>
                                </div>
                                {getLogClientName(log) && (
                                  <div>
                                    <Label className="text-muted-foreground">Client</Label>
                                    <p className="font-medium">{getLogClientName(log)}</p>
                                  </div>
                                )}
                                <div>
                                  <Label className="text-muted-foreground">Type</Label>
                                  <p>{getEntityLabel(log.entity)}</p>
                                </div>
                              </div>

                              {log.actionType === "create" && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Plus className="h-4 w-4 text-green-600" />
                                    Created Record
                                  </div>
                                  <ScrollArea className="max-h-[300px]">
                                    <div className="rounded-md border">
                                      {getChangedFields(null, log.newData as Record<string, unknown>).map((f, i) => (
                                        <div key={f.field} className={`flex items-center gap-3 px-3 py-2 text-sm ${i > 0 ? "border-t" : ""}`}>
                                          <span className="text-muted-foreground min-w-[140px]">{f.label}</span>
                                          <span className="font-medium">{formatFieldValue(f.field, f.newVal)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}

                              {log.actionType === "update" && (() => {
                                const fields = getChangedFields(
                                  log.oldData as Record<string, unknown>,
                                  log.newData as Record<string, unknown>
                                );
                                const changed = fields.filter(f => f.changed);
                                const unchanged = fields.filter(f => !f.changed);
                                return (
                                  <div className="space-y-3">
                                    {changed.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-sm font-medium">Changes</div>
                                        <div className="rounded-md border">
                                          {changed.map((f, i) => (
                                            <div key={f.field} className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm bg-muted/30 ${i > 0 ? "border-t" : ""}`}>
                                              <span className="text-muted-foreground min-w-[140px]">{f.label}</span>
                                              <span className="line-through text-red-500/80">{formatFieldValue(f.field, f.oldVal)}</span>
                                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                              <span className="font-medium text-green-600">{formatFieldValue(f.field, f.newVal)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {unchanged.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="text-sm text-muted-foreground">Unchanged Fields</div>
                                        <div className="rounded-md border">
                                          {unchanged.map((f, i) => (
                                            <div key={f.field} className={`flex items-center gap-3 px-3 py-2 text-sm ${i > 0 ? "border-t" : ""}`}>
                                              <span className="text-muted-foreground min-w-[140px]">{f.label}</span>
                                              <span>{formatFieldValue(f.field, f.newVal)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {log.actionType === "delete" && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Minus className="h-4 w-4 text-red-600" />
                                    Deleted Record
                                  </div>
                                  <ScrollArea className="max-h-[300px]">
                                    <div className="rounded-md border">
                                      {getChangedFields(log.oldData as Record<string, unknown>, null).map((f, i) => (
                                        <div key={f.field} className={`flex items-center gap-3 px-3 py-2 text-sm ${i > 0 ? "border-t" : ""}`}>
                                          <span className="text-muted-foreground min-w-[140px]">{f.label}</span>
                                          <span className="line-through text-red-500/80">{formatFieldValue(f.field, f.oldVal)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
