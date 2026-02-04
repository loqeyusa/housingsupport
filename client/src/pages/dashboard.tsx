import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Users,
  DollarSign,
  Home,
  Receipt,
  PiggyBank,
  TrendingUp,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  Activity,
} from "lucide-react";
import type { Activity as ActivityType, Client, County } from "@shared/schema";

interface DashboardMetrics {
  totalClients: number;
  totalHousingSupport: number;
  totalRentPaid: number;
  totalExpenses: number;
  totalPoolFund: number;
  poolContributors: number;
}

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: counties } = useQuery<County[]>({
    queryKey: ["/api/counties"],
  });

  const { data: activities } = useQuery<ActivityType[]>({
    queryKey: ["/api/activities"],
  });

  const countyDistribution = counties?.map((county) => ({
    name: county.name,
    count: clients?.filter((c) => c.countyId === county.id).length || 0,
  })).filter((c) => c.count > 0) || [];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const metricCards = [
    {
      title: "Total Clients",
      value: metrics?.totalClients || clients?.length || 0,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Housing Support",
      value: formatCurrency(metrics?.totalHousingSupport || 0),
      icon: Home,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Rent Paid",
      value: formatCurrency(metrics?.totalRentPaid || 0),
      icon: DollarSign,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Total Expenses",
      value: formatCurrency(metrics?.totalExpenses || 0),
      icon: Receipt,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: "Pool Fund",
      value: formatCurrency(metrics?.totalPoolFund || 0),
      icon: PiggyBank,
      color: (metrics?.totalPoolFund || 0) >= 0 ? "text-emerald-500" : "text-red-500",
      bgColor: (metrics?.totalPoolFund || 0) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10",
    },
    {
      title: "Pool Contributors",
      value: metrics?.poolContributors || 0,
      icon: TrendingUp,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of housing support operations
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metricCards.map((metric, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold" data-testid={`metric-${metric.title.toLowerCase().replace(" ", "-")}`}>
                    {metric.value}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">County Distribution</CardTitle>
              <CardDescription>Clients by county</CardDescription>
            </CardHeader>
            <CardContent>
              {countyDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No client data available
                </p>
              ) : (
                <div className="space-y-3">
                  {countyDistribution.map((county, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{county.name}</span>
                      <Badge variant="secondary">{county.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href="/clients/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Client
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href="/bulk-updates">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Bulk Financial Update
                </Link>
              </Button>
              <Button asChild className="w-full justify-start" variant="outline">
                <Link href="/reports">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Generate Reports
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest system actions</CardDescription>
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {!activities || activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 10).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex flex-col space-y-1 border-l-2 border-muted pl-3 py-1"
                      >
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
