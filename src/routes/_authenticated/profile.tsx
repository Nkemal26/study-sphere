import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, User as UserIcon } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — NoteShare" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, roles } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", bio: "", faculty_id: "", department_id: "", level: "" });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: faculties } = useQuery({
    queryKey: ["faculties-p"],
    queryFn: async () => (await supabase.from("faculties").select("id,name").order("name")).data ?? [],
  });
  const { data: departments } = useQuery({
    queryKey: ["departments-p", form.faculty_id],
    queryFn: async () =>
      form.faculty_id
        ? (await supabase.from("departments").select("id,name").eq("faculty_id", form.faculty_id).order("name")).data ?? []
        : [],
    enabled: !!form.faculty_id,
  });

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      bio: profile.bio ?? "",
      faculty_id: profile.faculty_id ?? "",
      department_id: profile.department_id ?? "",
      level: profile.level ?? "",
    });
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name,
      bio: form.bio || null,
      faculty_id: form.faculty_id || null,
      department_id: form.department_id || null,
      level: form.level || null,
    }).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 font-display text-2xl">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                  {(form.full_name || user?.email || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>Your profile</div>
                <div className="mt-1 flex gap-1.5">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary" className="capitalize">{r}</Badge>
                  ))}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-5">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fn">Full name</Label>
                <Input id="fn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={500} placeholder="Tell others about yourself" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Faculty</Label>
                  <Select value={form.faculty_id} onValueChange={(v) => setForm({ ...form, faculty_id: v, department_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{(faculties ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v })} disabled={!form.faculty_id}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{["100","200","300","400","500","600"].map((l) => <SelectItem key={l} value={l}>Level {l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Need lecturer access?</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Contact a NoteShare administrator to be upgraded to a lecturer account, which lets you upload official course notes.
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
