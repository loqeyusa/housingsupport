import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  History,
  Home,
  Building,
  Edit,
  ArrowLeft,
  Calendar,
  Upload,
} from "lucide-react";
import type {
  Client,
  County,
  ServiceType,
  ServiceStatus,
  ClientHousing,
  ClientDocument,
  ClientMonth,
  ClientHistory,
  HousingSupport,
  RentPayment,
} from "@shared/schema";

export default function ClientDetailPage() {
  const [, params] = useRoute("/clients/:id");
  const clientId = params?.id;

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId,
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

  const { data: housing } = useQuery<ClientHousing>({
    queryKey: ["/api/clients", clientId, "housing"],
    enabled: !!clientId,
  });

  const { data: documents } = useQuery<ClientDocument[]>({
    queryKey: ["/api/clients", clientId, "documents"],
    enabled: !!clientId,
  });

  const { data: clientMonths } = useQuery<ClientMonth[]>({
    queryKey: ["/api/clients", clientId, "months"],
    enabled: !!clientId,
  });

  const { data: history } = useQuery<ClientHistory[]>({
    queryKey: ["/api/clients", clientId, "history"],
    enabled: !!clientId,
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

  const getDocumentTypeBadge = (type: string) => {
    const variants: Record<string, string> = {
      HS_AWARD: "default",
      LEASE: "secondary",
      POLICY: "outline",
      OTHER: "outline",
    };
    const labels: Record<string, string> = {
      HS_AWARD: "HS Award Letter",
      LEASE: "Lease",
      POLICY: "Policy Signed",
      OTHER: "Other",
    };
    return (
      <Badge variant={variants[type] as "default" | "secondary" | "outline"}>
        {labels[type] || type}
      </Badge>
    );
  };

  const formatMonth = (year: number, month: number) => {
    return new Date(year, month - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  if (clientLoading) {
    return (
      <DashboardLayout title="Client Details" breadcrumbs={[{ label: "Clients", href: "/clients" }]}>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout title="Client Not Found" breadcrumbs={[{ label: "Clients", href: "/clients" }]}>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found</p>
            <Button asChild className="mt-4">
              <Link href="/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Clients
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={client.fullName}
      breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: client.fullName }]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/clients">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{client.fullName}</h1>
              <p className="text-muted-foreground">
                Case #{client.countyCaseNumber || "N/A"}
              </p>
            </div>
          </div>
          <Button asChild data-testid="button-edit-client">
            <Link href={`/clients/${client.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Client
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile" data-testid="tab-profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="housing" data-testid="tab-housing">
              <Home className="mr-2 h-4 w-4" />
              Housing
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials">
              <DollarSign className="mr-2 h-4 w-4" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">{client.fullName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{client.phone || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">County</p>
                      <p className="font-medium">{getCountyName(client.countyId)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Service Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Case Number</p>
                    <p className="font-medium">{client.countyCaseNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Service Type</p>
                    <p className="font-medium">{getServiceTypeName(client.serviceTypeId)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className="mt-1">{getServiceStatusName(client.serviceStatusId)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="housing">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Housing & Landlord Information</CardTitle>
              </CardHeader>
              <CardContent>
                {housing ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Client Address</p>
                          <p className="font-medium">{housing.address || "-"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Landlord Name</p>
                          <p className="font-medium">{housing.landlordName || "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Landlord Phone</p>
                          <p className="font-medium">{housing.landlordPhone || "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Landlord Address</p>
                          <p className="font-medium">{housing.landlordAddress || "-"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No housing information on file
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <CardDescription>Client documents and files</CardDescription>
                </div>
                <Button size="sm" data-testid="button-upload-document">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </CardHeader>
              <CardContent>
                {documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>{getDocumentTypeBadge(doc.documentType)}</TableCell>
                          <TableCell>
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                View
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No documents uploaded
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Financial Records</CardTitle>
                <CardDescription>Housing support, rent, and expenses by month</CardDescription>
              </CardHeader>
              <CardContent>
                {clientMonths && clientMonths.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientMonths.map((month) => (
                        <TableRow key={month.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {formatMonth(month.year, month.month)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={month.isLocked ? "secondary" : "default"}>
                              {month.isLocked ? "Locked" : "Open"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/clients/${clientId}/months/${month.id}`}>
                                View Details
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No financial records yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Change History</CardTitle>
                <CardDescription>All changes made to this client record</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {history && history.length > 0 ? (
                    <div className="space-y-4">
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-4 border-l-2 border-muted pl-4 pb-4"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{item.fieldChanged}</p>
                            <p className="text-sm text-muted-foreground">
                              Changed from "{item.oldValue || "empty"}" to "{item.newValue}"
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(item.changedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No change history
                    </p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
