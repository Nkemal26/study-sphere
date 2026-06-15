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

  const toggleRestrict = async (userId: string, restrict: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_restricted: restrict }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success(restrict ? "User restricted" : "Access restored");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const resolveReport = async (id: string, status: "resolved" | "dismissed") => {
    await supabase.from("reports").update({ status }).eq("id", id);
    toast.success("Report updated");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  };

  const getRoleFor = (uid: string) => allRoles?.find((r) => r.user_id === uid)?.role ?? "student";


  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <Header />

      <section className="relative border-b border-slate-800 bg-slate-950">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="container relative mx-auto px-4 py-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">
            <ShieldAlert className="h-3 w-3" /> Control panel · Admin
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">System administration</h1>
          <p className="mt-1 text-sm text-slate-400">Moderate uploads, manage user access and resolve reports across NoteShare.</p>
        </div>
      </section>

      <div className="container mx-auto space-y-8 px-4 py-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Users", value: stats?.users ?? 0, icon: Users, accent: "text-sky-400" },
            { label: "Notes", value: stats?.notes ?? 0, icon: FileText, accent: "text-emerald-400" },
            { label: "Downloads", value: stats?.downloads ?? 0, icon: FileText, accent: "text-violet-400" },
            { label: "Pending review", value: stats?.pending ?? 0, icon: ShieldAlert, accent: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
                <span>{s.label}</span>
                <s.icon className={`h-3.5 w-3.5 ${s.accent}`} />
              </div>
              <div className="mt-1 font-display text-3xl font-bold tabular-nums">{s.value}</div>
            </div>
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
                  <div key={u.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{u.full_name || "—"}</span>
                        {u.is_restricted && <Badge variant="destructive" className="text-[10px]">Restricted</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
