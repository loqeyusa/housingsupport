import { useState, useEffect } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  User as UserIcon,
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
  Loader2,
  Eye,
  User,
  ChevronLeft,
  ChevronRight,
  Plus,
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
  User as UserType,
} from "@shared/schema";

export default function ClientDetailPage() {
  const [, params] = useRoute("/clients/:id");
  const clientId = params?.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Document viewer state
  const [viewingDocument, setViewingDocument] = useState<ClientDocument | null>(null);
  const [documentBlobUrl, setDocumentBlobUrl] = useState<string | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  
  // Financials month navigation state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

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
  
  // Find current month record from clientMonths
  const currentMonthRecord = clientMonths?.find(
    (m) => m.year === selectedYear && m.month === selectedMonth
  );
  
  // Fetch financial details for selected month
  const { data: monthlyHousingSupport } = useQuery<HousingSupport>({
    queryKey: ["/api/housing-supports", { clientMonthId: currentMonthRecord?.id }],
    enabled: !!currentMonthRecord?.id,
  });
  
  const { data: monthlyRent } = useQuery<RentPayment>({
    queryKey: ["/api/rent-payments", { clientMonthId: currentMonthRecord?.id }],
    enabled: !!currentMonthRecord?.id,
  });
  
  const { data: monthlyExpenses } = useQuery<any[]>({
    queryKey: ["/api/expenses", { clientMonthId: currentMonthRecord?.id }],
    enabled: !!currentMonthRecord?.id,
  });
  
  const { data: monthlyLth } = useQuery<any[]>({
    queryKey: ["/api/lth-payments", { clientMonthId: currentMonthRecord?.id }],
    enabled: !!currentMonthRecord?.id,
  });
  
  const { data: monthlyPoolFund } = useQuery<any>({
    queryKey: ["/api/pool-funds", { clientMonthId: currentMonthRecord?.id }],
    enabled: !!currentMonthRecord?.id,
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

  // Document viewing - fetch with auth and display in modal
  const handleViewDocument = async (doc: ClientDocument) => {
    setViewingDocument(doc);
    setIsLoadingDocument(true);
    
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(doc.fileUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to load document");
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setDocumentBlobUrl(blobUrl);
    } catch (error) {
      toast({
        title: "Failed to load document",
        description: "Could not retrieve the document. Please try again.",
        variant: "destructive",
      });
      setViewingDocument(null);
    } finally {
      setIsLoadingDocument(false);
    }
  };

  const closeDocumentViewer = () => {
    if (documentBlobUrl) {
      URL.revokeObjectURL(documentBlobUrl);
    }
    setViewingDocument(null);
    setDocumentBlobUrl(null);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (documentBlobUrl) {
        URL.revokeObjectURL(documentBlobUrl);
      }
    };
  }, [documentBlobUrl]);

  // Month navigation functions
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

  // Calculate pool fund for display
  const calculatePoolFund = () => {
    const housingSupport = parseFloat(monthlyHousingSupport?.amount || "0");
    const rentPaid = parseFloat(monthlyRent?.paidAmount || "0");
    const totalExpenses = (monthlyExpenses || []).reduce(
      (sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0
    );
    return housingSupport - (rentPaid + totalExpenses);
  };

  const handleDocumentUpload = async () => {
    if (!selectedFile || !selectedDocType || !clientId) return;
    
    setIsUploading(true);
    try {
      // Step 1: Get presigned URL (authenticated)
      const token = localStorage.getItem("auth_token");
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || "application/octet-stream",
        }),
      });
      
      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }
      
      const { uploadURL, objectPath } = await urlResponse.json();
      
      // Step 2: Upload file to presigned URL
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
      });
      
      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }
      
      // Step 3: Save document record
      await apiRequest("POST", "/api/client-documents", {
        clientId,
        documentType: selectedDocType,
        fileUrl: objectPath,
        uploadedBy: user?.id,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "documents"] });
      
      toast({
        title: "Document uploaded",
        description: `${selectedFile.name} has been uploaded successfully.`,
      });
      
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedDocType("");
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Documents</CardTitle>
                  <CardDescription>Client documents and files</CardDescription>
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-upload-document">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                      <DialogDescription>
                        Select the document type and upload a file (PDF or image)
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Document Type</Label>
                        <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                          <SelectTrigger data-testid="select-doc-type">
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HS_AWARD">HS Award Letter</SelectItem>
                            <SelectItem value="LEASE">Lease</SelectItem>
                            <SelectItem value="POLICY">Policy Signed</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>File</Label>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.gif"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          data-testid="input-document-file"
                        />
                        {selectedFile && (
                          <p className="text-sm text-muted-foreground">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleDocumentUpload}
                        disabled={!selectedFile || !selectedDocType || isUploading}
                        data-testid="button-confirm-upload"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {documents && documents.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Uploaded By</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                          <TableCell>{getDocumentTypeBadge(doc.documentType)}</TableCell>
                          <TableCell>
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-sm">
                              {doc.uploadedBy || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewDocument(doc)}
                              data-testid={`button-view-document-${doc.id}`}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              View
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
            
            {/* Document Viewer Modal */}
            <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && closeDocumentViewer()}>
              <DialogContent className="max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Document Viewer</DialogTitle>
                  <DialogDescription>
                    {viewingDocument && (
                      <>
                        {getDocumentTypeBadge(viewingDocument.documentType)}
                        <span className="ml-2 text-sm">
                          Uploaded {new Date(viewingDocument.uploadedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div 
                  className="flex items-center justify-center min-h-[400px] bg-muted rounded-lg overflow-hidden"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {isLoadingDocument ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading document...</p>
                    </div>
                  ) : documentBlobUrl ? (
                    <img 
                      src={documentBlobUrl} 
                      alt="Document" 
                      className="max-w-full max-h-[60vh] object-contain select-none"
                      style={{ pointerEvents: "none" }}
                      draggable={false}
                      data-testid="image-document-viewer"
                    />
                  ) : (
                    <p className="text-muted-foreground">Unable to display document</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="financials">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Monthly Financial Records</CardTitle>
                  <CardDescription>Housing support, rent, expenses, and pool fund by month</CardDescription>
                </div>
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
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Housing Support</div>
                        <div className="text-2xl font-bold text-green-600" data-testid="text-housing-support-amount">
                          ${parseFloat(monthlyHousingSupport?.amount || "0").toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Rent Paid</div>
                        <div className="text-2xl font-bold" data-testid="text-rent-paid-amount">
                          ${parseFloat(monthlyRent?.paidAmount || "0").toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total Expenses</div>
                        <div className="text-2xl font-bold" data-testid="text-expenses-amount">
                          ${(monthlyExpenses || []).reduce((sum: number, e: any) => sum + parseFloat(e.amount || "0"), 0).toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Pool Fund</div>
                        <div 
                          className={`text-2xl font-bold ${calculatePoolFund() >= 0 ? 'text-blue-600' : 'text-red-600'}`}
                          data-testid="text-pool-fund-amount"
                        >
                          ${calculatePoolFund().toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {currentMonthRecord ? (
                      <Badge variant={currentMonthRecord.isLocked ? "secondary" : "default"}>
                        {currentMonthRecord.isLocked ? "Locked" : "Open for Editing"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No Record</Badge>
                    )}
                  </div>

                  {/* Detailed Sections */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Rent Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Rent Details
                      </h4>
                      {monthlyRent ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Expected Amount</span>
                            <span>${parseFloat(monthlyRent.expectedAmount || "0").toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount Paid</span>
                            <span>${parseFloat(monthlyRent.paidAmount || "0").toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Paid Date</span>
                            <span>{monthlyRent.paidDate ? new Date(monthlyRent.paidDate).toLocaleDateString() : "-"}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No rent data for this month</p>
                      )}
                    </div>
                    
                    {/* Expenses List */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Expenses ({(monthlyExpenses || []).length})
                      </h4>
                      {monthlyExpenses && monthlyExpenses.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-auto">
                          {monthlyExpenses.map((expense: any) => (
                            <div key={expense.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{expense.description || "Expense"}</span>
                              <span>${parseFloat(expense.amount || "0").toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No expenses for this month</p>
                      )}
                    </div>
                    
                    {/* LTH Payments */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        LTH Payments ({(monthlyLth || []).length})
                      </h4>
                      {monthlyLth && monthlyLth.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-auto">
                          {monthlyLth.map((lth: any) => (
                            <div key={lth.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {lth.paymentDate ? new Date(lth.paymentDate).toLocaleDateString() : "Payment"}
                              </span>
                              <span>${parseFloat(lth.amount || "0").toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No LTH payments for this month</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  {currentMonthRecord && (
                    <div className="pt-4 border-t">
                      <Button asChild variant="outline" data-testid="button-edit-financials">
                        <Link href={`/clients/${clientId}/months/${currentMonthRecord.id}`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Financial Details
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
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
