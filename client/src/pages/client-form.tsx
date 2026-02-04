import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import type { Client, County, ServiceType, ServiceStatus } from "@shared/schema";

const clientFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  countyCaseNumber: z.string().optional(),
  countyId: z.string().optional(),
  serviceTypeId: z.string().optional(),
  serviceStatusId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

export default function ClientFormPage() {
  const [, setLocation] = useLocation();
  const [matchNew] = useRoute("/clients/new");
  const [matchEdit, editParams] = useRoute("/clients/:id/edit");
  const isEditing = !!matchEdit;
  const clientId = editParams?.id;
  const { toast } = useToast();

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
    enabled: !!clientId && isEditing,
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

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      countyCaseNumber: "",
      countyId: "",
      serviceTypeId: "",
      serviceStatusId: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (client && isEditing) {
      form.reset({
        fullName: client.fullName,
        phone: client.phone || "",
        countyCaseNumber: client.countyCaseNumber || "",
        countyId: client.countyId || "",
        serviceTypeId: client.serviceTypeId || "",
        serviceStatusId: client.serviceStatusId || "",
        isActive: client.isActive,
      });
    }
  }, [client, isEditing, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      return apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client created",
        description: "The client has been created successfully.",
      });
      setLocation("/clients");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      return apiRequest("PATCH", `/api/clients/${clientId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Client updated",
        description: "The client has been updated successfully.",
      });
      setLocation(`/clients/${clientId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClientFormData) => {
    const cleanedData = {
      ...data,
      countyId: data.countyId || null,
      serviceTypeId: data.serviceTypeId || null,
      serviceStatusId: data.serviceStatusId || null,
    };

    if (isEditing) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && clientLoading) {
    return (
      <DashboardLayout
        title="Loading..."
        breadcrumbs={[{ label: "Clients", href: "/clients" }]}
      >
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={isEditing ? "Edit Client" : "New Client"}
      breadcrumbs={[
        { label: "Clients", href: "/clients" },
        { label: isEditing ? client?.fullName || "Edit" : "New Client" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={isEditing ? `/clients/${clientId}` : "/clients"}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditing ? "Edit Client" : "New Client"}
            </h1>
            <p className="text-muted-foreground">
              {isEditing
                ? "Update client information"
                : "Add a new client to the system"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Basic client details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter full name"
                            data-testid="input-full-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter phone number"
                            data-testid="input-phone"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service Information</CardTitle>
                <CardDescription>County and service details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="countyCaseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County Case Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter case number"
                            data-testid="input-case-number"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="countyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-county">
                              <SelectValue placeholder="Select county" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {counties?.map((county) => (
                              <SelectItem key={county.id} value={county.id}>
                                {county.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="serviceTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-service-type">
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {serviceTypes?.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serviceStatusId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-service-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {serviceStatuses?.map((status) => (
                              <SelectItem key={status.id} value={status.id}>
                                {status.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Set whether this client is currently active
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                asChild
              >
                <Link href={isEditing ? `/clients/${clientId}` : "/clients"}>
                  Cancel
                </Link>
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-client">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {isEditing ? "Update Client" : "Create Client"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
