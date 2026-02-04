import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, MapPin, Briefcase, CheckCircle, CreditCard, FolderOpen, Loader2 } from "lucide-react";
import type { County, ServiceType, ServiceStatus, PaymentMethod, ExpenseCategory } from "@shared/schema";

interface ReferenceItem {
  id: string;
  name: string;
  isActive?: boolean;
}

function ReferenceTable({
  title,
  description,
  icon: Icon,
  items,
  isLoading,
  apiEndpoint,
  hasActiveStatus,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  items: ReferenceItem[] | undefined;
  isLoading: boolean;
  apiEndpoint: string;
  hasActiveStatus: boolean;
}) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ReferenceItem | null>(null);
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", apiEndpoint, { name, isActive: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      toast({ title: "Created successfully" });
      setIsDialogOpen(false);
      setNewName("");
    },
    onError: () => {
      toast({ title: "Failed to create", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReferenceItem> }) => {
      return apiRequest("PATCH", `${apiEndpoint}/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      toast({ title: "Updated successfully" });
      setEditingItem(null);
      setNewName("");
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (newName.trim()) {
      createMutation.mutate(newName.trim());
    }
  };

  const handleUpdate = () => {
    if (editingItem && newName.trim()) {
      updateMutation.mutate({ id: editingItem.id, data: { name: newName.trim() } });
    }
  };

  const handleToggleActive = (item: ReferenceItem) => {
    updateMutation.mutate({ id: item.id, data: { isActive: !item.isActive } });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              onClick={() => {
                setNewName("");
                setEditingItem(null);
              }}
              data-testid={`button-add-${title.toLowerCase().replace(" ", "-")}`}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add {title.slice(0, -1)}</DialogTitle>
              <DialogDescription>Create a new {title.toLowerCase().slice(0, -1)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`Enter ${title.toLowerCase().slice(0, -1)} name`}
                  data-testid="input-new-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isPending || !newName.trim()}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : items?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No items yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {hasActiveStatus && <TableHead>Status</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  {hasActiveStatus && (
                    <TableCell>
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {hasActiveStatus && (
                        <Switch
                          checked={item.isActive}
                          onCheckedChange={() => handleToggleActive(item)}
                          data-testid={`switch-active-${item.id}`}
                        />
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingItem(item);
                              setNewName(item.name);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit {title.slice(0, -1)}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Name</Label>
                              <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                data-testid="input-edit-name"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleUpdate} disabled={isPending}>
                              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: counties, isLoading: countiesLoading } = useQuery<County[]>({
    queryKey: ["/api/counties"],
  });

  const { data: serviceTypes, isLoading: typesLoading } = useQuery<ServiceType[]>({
    queryKey: ["/api/service-types"],
  });

  const { data: serviceStatuses, isLoading: statusesLoading } = useQuery<ServiceStatus[]>({
    queryKey: ["/api/service-statuses"],
  });

  const { data: paymentMethods, isLoading: methodsLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
  });

  const { data: expenseCategories, isLoading: categoriesLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage reference data and system configuration
          </p>
        </div>

        <Tabs defaultValue="counties" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-2">
            <TabsTrigger value="counties" data-testid="tab-counties">
              <MapPin className="mr-2 h-4 w-4" />
              Counties
            </TabsTrigger>
            <TabsTrigger value="service-types" data-testid="tab-service-types">
              <Briefcase className="mr-2 h-4 w-4" />
              Service Types
            </TabsTrigger>
            <TabsTrigger value="service-statuses" data-testid="tab-service-statuses">
              <CheckCircle className="mr-2 h-4 w-4" />
              Statuses
            </TabsTrigger>
            <TabsTrigger value="payment-methods" data-testid="tab-payment-methods">
              <CreditCard className="mr-2 h-4 w-4" />
              Payment Methods
            </TabsTrigger>
            <TabsTrigger value="expense-categories" data-testid="tab-expense-categories">
              <FolderOpen className="mr-2 h-4 w-4" />
              Expense Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="counties">
            <ReferenceTable
              title="Counties"
              description="Geographic service areas"
              icon={MapPin}
              items={counties}
              isLoading={countiesLoading}
              apiEndpoint="/api/counties"
              hasActiveStatus={true}
            />
          </TabsContent>

          <TabsContent value="service-types">
            <ReferenceTable
              title="Service Types"
              description="Types of housing support services"
              icon={Briefcase}
              items={serviceTypes}
              isLoading={typesLoading}
              apiEndpoint="/api/service-types"
              hasActiveStatus={true}
            />
          </TabsContent>

          <TabsContent value="service-statuses">
            <ReferenceTable
              title="Service Statuses"
              description="Client service status options"
              icon={CheckCircle}
              items={serviceStatuses}
              isLoading={statusesLoading}
              apiEndpoint="/api/service-statuses"
              hasActiveStatus={false}
            />
          </TabsContent>

          <TabsContent value="payment-methods">
            <ReferenceTable
              title="Payment Methods"
              description="Available payment methods"
              icon={CreditCard}
              items={paymentMethods}
              isLoading={methodsLoading}
              apiEndpoint="/api/payment-methods"
              hasActiveStatus={false}
            />
          </TabsContent>

          <TabsContent value="expense-categories">
            <ReferenceTable
              title="Expense Categories"
              description="Categories for expense tracking"
              icon={FolderOpen}
              items={expenseCategories}
              isLoading={categoriesLoading}
              apiEndpoint="/api/expense-categories"
              hasActiveStatus={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
