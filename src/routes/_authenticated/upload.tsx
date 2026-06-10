import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { FileText, Loader2, Upload as UploadIcon } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/upload")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const allowed = (roles ?? []).some((r) => r.role === "lecturer" || r.role === "admin");
    if (!allowed) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Upload Notes — NoteShare" }] }),
  component: UploadPage,
});

const ALLOWED = ["pdf", "docx", "doc", "ppt", "pptx", "zip"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  faculty_id: z.string().uuid("Select a faculty"),
  department_id: z.string().uuid("Select a department"),
  course_id: z.string().uuid().optional().or(z.literal("")),
  level: z.string().optional(),
  semester: z.string().optional(),
  tags: z.string().optional(),
});

function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    faculty_id: "",
    department_id: "",
    course_id: "",
    level: "",
    semester: "",
    tags: "",
  });

  const { data: faculties } = useQuery({
    queryKey: ["faculties-up"],
    queryFn: async () => (await supabase.from("faculties").select("id,name").order("name")).data ?? [],
  });
  const { data: departments } = useQuery({
    queryKey: ["departments-up", form.faculty_id],
    queryFn: async () => {
      if (!form.faculty_id) return [];
      return (await supabase.from("departments").select("id,name").eq("faculty_id", form.faculty_id).order("name")).data ?? [];
    },
    enabled: !!form.faculty_id,
  });
  const { data: courses } = useQuery({
    queryKey: ["courses-up", form.department_id],
    queryFn: async () => {
      if (!form.department_id) return [];
      return (await supabase.from("courses").select("id,code,title").eq("department_id", form.department_id).order("code")).data ?? [];
    },
    enabled: !!form.department_id,
  });

  const onFile = (f: File | null) => {
    if (!f) return setFile(null);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext)) return toast.error(`File type .${ext} not allowed. Use ${ALLOWED.join(", ")}.`);
    if (f.size > MAX_SIZE) return toast.error("File must be under 50 MB");
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Attach a file to upload");
    if (!user) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("notes").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("notes").getPublicUrl(path);

      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

      const { data: note, error } = await supabase.from("notes").insert({
        title: parsed.data.title,
        description: parsed.data.description || null,
        file_path: path,
        file_url: urlData.publicUrl,
        file_type: ext,
        file_size: file.size,
        faculty_id: form.faculty_id || null,
        department_id: form.department_id || null,
        course_id: form.course_id || null,
        level: form.level || null,
        semester: form.semester || null,
        tags,
        uploaded_by: user.id,
        status: "pending",
      }).select("id").single();
      if (error) throw error;

      toast.success("Uploaded! Awaiting admin approval.");
      navigate({ to: "/notes/$id", params: { id: note.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <UploadIcon className="h-5 w-5 text-primary" /> Upload notes
            </CardTitle>
            <CardDescription>
              PDF, DOCX, PPT or ZIP up to 50 MB. Notes are reviewed before they go live.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              {/* File */}
              <div>
                <Label>File</Label>
                <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 transition-colors hover:border-primary hover:bg-primary-soft">
                  <FileText className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">
                    {file ? file.name : "Click to choose a file"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ALLOWED.map((e) => "." + e).join(" · ")} · max 50MB
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept={ALLOWED.map((e) => "." + e).join(",")}
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's in these notes? Topics covered, week, exam prep…" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Faculty">
                  <Select value={form.faculty_id} onValueChange={(v) => setForm({ ...form, faculty_id: v, department_id: "", course_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                    <SelectContent>
                      {(faculties ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Department">
                  <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v, course_id: "" })} disabled={!form.faculty_id}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Course (optional)">
                  <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })} disabled={!form.department_id}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {(courses ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} · {c.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Level">
                  <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      {["100","200","300","400","500","600"].map((l) => <SelectItem key={l} value={l}>Level {l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Semester">
                  <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
                    <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Semester 1">Semester 1</SelectItem>
                      <SelectItem value="Semester 2">Semester 2</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tags (comma-separated)">
                  <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="midterm, lecture, exam-prep" />
                </Field>
              </div>

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadIcon className="mr-2 h-4 w-4" />}
                Upload notes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
