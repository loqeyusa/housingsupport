import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Filter, Eye } from "lucide-react";
import type { Client, County, ServiceType, ServiceStatus } from "@shared/schema";

type ClientWithSaStatus = Client & { saStatus?: string };

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: clients, isLoading } = useQuery<ClientWithSaStatus[]>({
    queryKey: ["/api/clients"],
  });

  const { data: counties } = useQuery<County[]>({
    queryKey: ["/api/counties"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: serviceStatuses } = useQuery<ServiceStatus[]>({
    queryKey: ["/api/service-statuses"],
  });

  const getCountyName = (countyId: string | null) => {
    if (!countyId) return "-";
    return counties?.find((c) => c.id === countyId)?.name || "-";
  };

  const getServiceTypeName = (typeId: string | null) => {
    if (!typeId) return "-";
    return serviceTypes?.find((t) => t.id === typeId)?.name || "-";
  };

  const getServiceStatusName = (statusId: string | null) => {
    if (!statusId) return "-";
    return serviceStatuses?.find((s) => s.id === statusId)?.name || "-";
  };

  const getStatusBadgeVariant = (statusId: string | null) => {
    if (!statusId) return "secondary";
    const status = serviceStatuses?.find((s) => s.id === statusId);
    if (status?.name === "Active") return "default";
    if (status?.name === "Inactive") return "secondary";
    return "destructive";
  };

  const getSaStatusLabel = (saStatus?: string) => {
    switch (saStatus) {
      case "active": return "Active";
      case "expired": return "Expired";
      case "expiring_soon": return "Expiring Soon";
      case "suspended": return "Suspended";
      case "override_active": return "Active (Override)";
      default: return "Unknown";
    }
  };

  const getSaStatusVariant = (saStatus?: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (saStatus) {
      case "active": return "default";
      case "override_active": return "default";
      case "expiring_soon": return "secondary";
      case "expired": return "destructive";
      case "suspended": return "destructive";
      default: return "outline";
    }
  };

  const filteredClients = clients?.filter((client) => {
    const matchesSearch =
      client.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (client.countyCaseNumber?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchesCounty =
      countyFilter === "all" || client.countyId === countyFilter;

    const matchesServiceType =
      serviceTypeFilter === "all" || client.serviceTypeId === serviceTypeFilter;

    const matchesStatus =
      statusFilter === "all" || client.saStatus === statusFilter || (statusFilter === "active" && client.saStatus === "override_active");

    return matchesSearch && matchesCounty && matchesServiceType && matchesStatus;
  });

  return (
    <DashboardLayout title="Clients">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">
              Manage housing support clients
            </p>
          </div>
          <Button asChild data-testid="button-add-client">
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Link>
          </Button>
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
                  placeholder="Search by name or case number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-clients"
                />
              </div>
              <Select value={countyFilter} onValueChange={setCountyFilter}>
                <SelectTrigger data-testid="select-county-filter">
                  <SelectValue placeholder="Filter by County" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counties</SelectItem>
                  {counties?.map((county) => (
                    <SelectItem key={county.id} value={county.id}>
                      {county.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger data-testid="select-service-type-filter">
                  <SelectValue placeholder="Filter by Service Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Service Types</SelectItem>
                  {serviceTypes?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client List</CardTitle>
            <CardDescription>
              {filteredClients?.length || 0} clients found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredClients?.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No clients found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Case Number</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((client) => (
                    <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                      <TableCell className="font-medium">{client.fullName}</TableCell>
                      <TableCell>{client.countyCaseNumber || "-"}</TableCell>
                      <TableCell>{getCountyName(client.countyId)}</TableCell>
                      <TableCell>{getServiceTypeName(client.serviceTypeId)}</TableCell>
                      <TableCell>
                        <Badge variant={getSaStatusVariant(client.saStatus)} data-testid={`badge-sa-status-${client.id}`}>
                          {getSaStatusLabel(client.saStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          data-testid={`button-view-client-${client.id}`}
                        >
                          <Link href={`/clients/${client.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
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
