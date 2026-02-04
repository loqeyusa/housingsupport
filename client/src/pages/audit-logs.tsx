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
import { FileText, Search, Eye, Filter } from "lucide-react";
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

  const filteredLogs = auditLogs?.filter((log) => {
    const matchesUser = userFilter === "all" || log.userId === userFilter;
    const matchesEntity = entityFilter === "all" || log.entity === entityFilter;
    const matchesAction = actionFilter === "all" || log.actionType === actionFilter;
    const matchesSearch =
      !search ||
      log.entity.toLowerCase().includes(search.toLowerCase()) ||
      log.actionType.toLowerCase().includes(search.toLowerCase()) ||
      (log.entityId && log.entityId.includes(search));

    return matchesUser && matchesEntity && matchesAction && matchesSearch;
  });

  const formatJson = (data: unknown) => {
    if (!data) return "null";
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
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
                    <TableHead>Entity</TableHead>
                    <TableHead>Entity ID</TableHead>
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
                      <TableCell className="font-medium">{log.entity}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.entityId ? `${log.entityId.slice(0, 8)}...` : "-"}
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
                                {log.actionType} on {log.entity} by {getUserName(log.userId)}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <Label className="text-muted-foreground">Timestamp</Label>
                                  <p>{new Date(log.createdAt).toLocaleString()}</p>
                                </div>
                                <div>
                                  <Label className="text-muted-foreground">Entity ID</Label>
                                  <p className="font-mono text-xs break-all">{log.entityId || "-"}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-muted-foreground">Old Value</Label>
                                <ScrollArea className="h-32 rounded-md border p-3">
                                  <pre className="text-xs font-mono">
                                    {formatJson(log.oldData)}
                                  </pre>
                                </ScrollArea>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-muted-foreground">New Value</Label>
                                <ScrollArea className="h-32 rounded-md border p-3">
                                  <pre className="text-xs font-mono">
                                    {formatJson(log.newData)}
                                  </pre>
                                </ScrollArea>
                              </div>
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
