import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, FileText, ShieldAlert, Users, X } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Admin — NoteShare" }] }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();

  const { data: pending } = useQuery({
    queryKey: ["admin-pending"],
    queryFn: async () => (await supabase
      .from("notes")
      .select("id,title,description,file_type,status,created_at,uploaded_by,uploader:profiles!notes_uploader_profile_fkey(full_name,email)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => (await supabase
      .from("reports")
      .select("id,reason,status,created_at,note:notes(id,title),reporter:profiles!reports_user_profile_fkey(full_name)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase
      .from("profiles")
      .select("id,full_name,email,created_at,is_restricted")
      .order("created_at", { ascending: false })
      .limit(100)).data ?? [],
  });

  const { data: allRoles } = useQuery({
    queryKey: ["admin-all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("user_id,role")).data ?? [],
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, notes, downloads, pendingC] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase.from("download_events").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        users: users.count ?? 0,
        notes: notes.count ?? 0,
        downloads: downloads.count ?? 0,
        pending: pendingC.count ?? 0,
      };
    },
  });

  const moderate = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase.from("notes").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Note ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
  };

  const setRole = async (userId: string, role: "student" | "lecturer" | "admin") => {
    // Remove existing roles then insert
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["admin-all-roles"] });
  };

  const resolveReport = async (id: string, status: "resolved" | "dismissed") => {
    await supabase.from("reports").update({ status }).eq("id", id);
    toast.success("Report updated");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const toggleRestrict = async (userId: string, restrict: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_restricted: restrict }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success(restrict ? "User restricted" : "Access restored");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const getRoleFor = (uid: string) => allRoles?.find((r) => r.user_id === uid)?.role ?? "student";


  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="bg-hero text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold md:text-4xl">
            <ShieldAlert className="h-6 w-6" /> Admin dashboard
          </h1>
          <p className="mt-1 text-white/80">Moderate uploads, manage users and handle reports.</p>
        </div>
      </section>

      <div className="container mx-auto space-y-8 px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Users", value: stats?.users ?? 0, icon: Users },
            { label: "Notes", value: stats?.notes ?? 0, icon: FileText },
            { label: "Downloads", value: stats?.downloads ?? 0, icon: FileText },
            { label: "Pending review", value: stats?.pending ?? 0, icon: ShieldAlert },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><div className="font-display text-3xl font-bold">{s.value}</div></CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending notes ({pending?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="reports">Reports ({reports?.filter((r) => r.status === "open").length ?? 0})</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardContent className="divide-y p-0">
                {(pending ?? []).map((n) => (
                  <div key={n.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="font-semibold">{n.title}</div>
                      <div className="text-xs text-muted-foreground">
                        by {(n as { uploader?: { full_name?: string } }).uploader?.full_name ?? "Unknown"} · {n.file_type.toUpperCase()}
                      </div>
                      {n.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => moderate(n.id, "rejected")}>
                        <X className="mr-1 h-3 w-3" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => moderate(n.id, "approved")}>
                        <Check className="mr-1 h-3 w-3" /> Approve
                      </Button>
                    </div>
                  </div>
                ))}
                {(pending?.length ?? 0) === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No notes pending review 🎉</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardContent className="divide-y p-0">
                {(reports ?? []).map((r) => (
                  <div key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">{(r as { note?: { title?: string } }).note?.title}</div>
                      <div className="text-xs text-muted-foreground">{(r as { reporter?: { full_name?: string } }).reporter?.full_name} reported:</div>
                      <p className="mt-1 text-sm">{r.reason}</p>
                      <Badge variant="outline" className="mt-2 capitalize">{r.status}</Badge>
                    </div>
                    {r.status === "open" && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => resolveReport(r.id, "dismissed")}>Dismiss</Button>
                        <Button size="sm" onClick={() => resolveReport(r.id, "resolved")}>Resolve</Button>
                      </div>
                    )}
                  </div>
                ))}
                {(reports?.length ?? 0) === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No reports.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardContent className="divide-y p-0">
                {(users ?? []).map((u) => (
                  <div key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{u.full_name || "—"}</span>
                        {u.is_restricted && <Badge variant="destructive" className="text-[10px]">Restricted</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={getRoleFor(u.id)} onValueChange={(v) => setRole(u.id, v as never)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="lecturer">Lecturer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant={u.is_restricted ? "outline" : "destructive"}
                        onClick={() => toggleRestrict(u.id, !u.is_restricted)}
                      >
                        {u.is_restricted ? "Unrestrict" : "Restrict"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}
