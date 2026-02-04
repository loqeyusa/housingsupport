import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Wallet,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import type { Client } from "@shared/schema";

interface PoolFundSummary {
  totalPoolFund: number;
  totalContributors: number;
  positiveContributors: number;
  negativeContributors: number;
  contributions: {
    clientId: string;
    clientName: string;
    county: string;
    poolAmount: number;
    housingSupport: number;
    rentPaid: number;
    expenses: number;
  }[];
}

export default function PoolFundPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");

  const { data: poolFundData, isLoading } = useQuery<PoolFundSummary>({
    queryKey: ["/api/pool-fund-summary", { year: selectedYear, month: viewMode === "monthly" ? selectedMonth : null }],
  });

  const formatMonth = (year: number, month: number) => {
    return new Date(year, month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const navigateToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const navigateToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <DashboardLayout title="Pool Fund" breadcrumbs={[{ label: "Pool Fund" }]}>
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pool Fund Overview</h1>
            <p className="text-muted-foreground">
              Track pool fund contributions and balances
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("monthly")}
                data-testid="button-view-monthly"
              >
                Monthly
              </Button>
              <Button
                variant={viewMode === "yearly" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("yearly")}
                data-testid="button-view-yearly"
              >
                Yearly
              </Button>
            </div>

            {/* Period Navigation */}
            {viewMode === "monthly" ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={navigateToPreviousMonth}
                  data-testid="button-prev-month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 min-w-[180px] justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatMonth(selectedYear, selectedMonth)}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={navigateToNextMonth}
                  data-testid="button-next-month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  data-testid="button-prev-year"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2 min-w-[100px] justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{selectedYear}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  data-testid="button-next-year"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Pool Fund</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${(poolFundData?.totalPoolFund || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                  data-testid="text-total-pool-fund"
                >
                  ${(poolFundData?.totalPoolFund || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {viewMode === "monthly" ? formatMonth(selectedYear, selectedMonth) : `Year ${selectedYear}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Contributors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-contributors">
                  {poolFundData?.totalContributors || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Clients with pool fund records
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Positive Balance</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-positive-contributors">
                  {poolFundData?.positiveContributors || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Clients with surplus
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Negative Balance</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-negative-contributors">
                  {poolFundData?.negativeContributors || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Clients with deficit
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contributors Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pool Fund Contributions</CardTitle>
            <CardDescription>
              Detailed breakdown of pool fund by client for{" "}
              {viewMode === "monthly" ? formatMonth(selectedYear, selectedMonth) : `Year ${selectedYear}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : poolFundData?.contributions && poolFundData.contributions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>County</TableHead>
                    <TableHead className="text-right">Housing Support</TableHead>
                    <TableHead className="text-right">Rent Paid</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Pool Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poolFundData.contributions.map((contribution) => (
                    <TableRow key={contribution.clientId} data-testid={`row-contribution-${contribution.clientId}`}>
                      <TableCell className="font-medium">{contribution.clientName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{contribution.county || "-"}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${contribution.housingSupport.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${contribution.rentPaid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${contribution.expenses.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-bold ${contribution.poolAmount >= 0 ? "text-blue-600" : "text-red-600"}`}
                        >
                          ${contribution.poolAmount.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No pool fund data</h3>
                <p className="text-muted-foreground">
                  No pool fund contributions recorded for this period
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
