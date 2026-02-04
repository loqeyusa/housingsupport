import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, BarChart3 } from "lucide-react";
import type { Client, County, ServiceType } from "@shared/schema";

interface ReportData {
  clientId: string;
  clientName: string;
  county: string;
  serviceType: string;
  totalHousingSupport: number;
  totalRentPaid: number;
  totalExpenses: number;
  poolFund: number;
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: counties } = useQuery<County[]>({
    queryKey: ["/api/counties"],
  });

  const { data: serviceTypes } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData[]>({
    queryKey: ["/api/reports", year, countyFilter, serviceTypeFilter],
  });

  const getCountyName = (countyId: string | null) => {
    if (!countyId) return "-";
    return counties?.find((c) => c.id === countyId)?.name || "-";
  };

  const getServiceTypeName = (typeId: string | null) => {
    if (!typeId) return "-";
    return serviceTypes?.find((t) => t.id === typeId)?.name || "-";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const filteredClients = clients?.filter((client) => {
    const matchesCounty = countyFilter === "all" || client.countyId === countyFilter;
    const matchesServiceType = serviceTypeFilter === "all" || client.serviceTypeId === serviceTypeFilter;
    return matchesCounty && matchesServiceType;
  });

  const handleExportCSV = () => {
    if (!filteredClients) return;

    const headers = ["Name", "County", "Service Type", "Status"];
    const rows = filteredClients.map((client) => [
      client.fullName,
      getCountyName(client.countyId),
      getServiceTypeName(client.serviceTypeId),
      client.isActive ? "Active" : "Inactive",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `housing-support-report-${year}.csv`;
    link.click();
  };

  const totals = {
    clients: filteredClients?.length || 0,
    housingSupport: 0,
    rentPaid: 0,
    expenses: 0,
    poolFund: 0,
  };

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Generate and export housing support reports
            </p>
          </div>
          <Button onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger data-testid="select-report-year">
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
                <Label>County</Label>
                <Select value={countyFilter} onValueChange={setCountyFilter}>
                  <SelectTrigger data-testid="select-report-county">
                    <SelectValue />
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
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger data-testid="select-report-service-type">
                    <SelectValue />
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
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totals.clients}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Housing Support
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.housingSupport)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Rent Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.rentPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pool Fund
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totals.poolFund)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Client Report - {year}
            </CardTitle>
            <CardDescription>
              {filteredClients?.length || 0} clients matching filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredClients?.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No clients match the selected filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients?.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.fullName}</TableCell>
                      <TableCell>{getCountyName(client.countyId)}</TableCell>
                      <TableCell>{getServiceTypeName(client.serviceTypeId)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            client.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {client.isActive ? "Active" : "Inactive"}
                        </span>
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
