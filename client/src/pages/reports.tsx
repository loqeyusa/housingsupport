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

  const reportsUrl = `/api/reports?year=${year}&county=${countyFilter}&serviceType=${serviceTypeFilter}`;
  
  const { data: reportData, isLoading: reportLoading } = useQuery<ReportData[]>({
    queryKey: [reportsUrl],
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
    if (!reportData || reportData.length === 0) return;

    const headers = ["Name", "County", "Service Type", "Housing Support", "Rent Paid", "Expenses", "Pool Fund"];
    const rows = reportData.map((report) => [
      report.clientName,
      report.county,
      report.serviceType,
      report.totalHousingSupport.toFixed(2),
      report.totalRentPaid.toFixed(2),
      report.totalExpenses.toFixed(2),
      report.poolFund.toFixed(2),
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
    clients: reportData?.length || 0,
    housingSupport: reportData?.reduce((sum, r) => sum + r.totalHousingSupport, 0) || 0,
    rentPaid: reportData?.reduce((sum, r) => sum + r.totalRentPaid, 0) || 0,
    expenses: reportData?.reduce((sum, r) => sum + r.totalExpenses, 0) || 0,
    poolFund: reportData?.reduce((sum, r) => sum + r.poolFund, 0) || 0,
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
              {reportData?.length || 0} clients matching filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : reportData?.length === 0 ? (
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
                    <TableHead className="text-right">Housing Support</TableHead>
                    <TableHead className="text-right">Rent Paid</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Pool Fund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.map((report) => (
                    <TableRow key={report.clientId}>
                      <TableCell className="font-medium">{report.clientName}</TableCell>
                      <TableCell>{report.county}</TableCell>
                      <TableCell>{report.serviceType}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.totalHousingSupport)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.totalRentPaid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.totalExpenses)}</TableCell>
                      <TableCell className="text-right">
                        <span className={report.poolFund >= 0 ? "text-emerald-600" : "text-red-600"}>
                          {formatCurrency(report.poolFund)}
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
