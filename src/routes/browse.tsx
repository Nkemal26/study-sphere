import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Filter, Search, X } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NoteCard, type NoteCardData } from "@/components/NoteCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const browseSearch = z.object({
  q: z.string().optional(),
  faculty: z.string().optional(),
  department: z.string().optional(),
  level: z.string().optional(),
  semester: z.string().optional(),
  sort: z.enum(["recent", "popular", "rated"]).optional(),
});

export const Route = createFileRoute("/browse")({
  validateSearch: browseSearch,
  head: () => ({
    meta: [
      { title: "Browse Notes — NoteShare" },
      { name: "description", content: "Search and filter notes by faculty, department, course, level and semester." },
    ],
  }),
  component: BrowsePage,
});

const LEVELS = ["100", "200", "300", "400", "500", "600"];
const SEMESTERS = ["Semester 1", "Semester 2"];

function BrowsePage() {
  const search = useSearch({ from: "/browse" });
  const navigate = useNavigate({ from: "/browse" });
  const [q, setQ] = useState(search.q ?? "");

  const { data: faculties } = useQuery({
    queryKey: ["faculties"],
    queryFn: async () => {
      const { data } = await supabase.from("faculties").select("id,name,slug").order("name");
      return data ?? [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments", search.faculty],
    queryFn: async () => {
      let query = supabase.from("departments").select("id,name,slug,faculty_id").order("name");
      if (search.faculty) {
        const fac = faculties?.find((f) => f.slug === search.faculty);
        if (fac) query = query.eq("faculty_id", fac.id);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !!faculties,
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ["browse-notes", search],
    queryFn: async (): Promise<NoteCardData[]> => {
      let q1 = supabase
        .from("notes")
        .select("id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,faculty:faculties(name,slug),department:departments(name,slug),course:courses(code,title)")
        .eq("status", "approved");

      if (search.q && search.q.trim()) q1 = q1.textSearch("search_vector", search.q.trim(), { type: "websearch", config: "english" });
      if (search.level) q1 = q1.eq("level", search.level);
      if (search.semester) q1 = q1.eq("semester", search.semester);

      if (search.sort === "popular") q1 = q1.order("downloads", { ascending: false });
      else if (search.sort === "rated") q1 = q1.order("average_rating", { ascending: false });
      else q1 = q1.order("created_at", { ascending: false });

      const { data, error } = await q1.limit(60);
      if (error) throw error;
      let rows = (data ?? []) as unknown as (NoteCardData & { faculty: { slug?: string } | null; department: { slug?: string } | null })[];
      if (search.faculty) rows = rows.filter((r) => r.faculty?.slug === search.faculty);
      if (search.department) rows = rows.filter((r) => r.department?.slug === search.department);
      return rows;
    },
  });

  const updateSearch = (patch: Partial<typeof search>) => {
    navigate({ search: { ...search, ...patch } as never });
  };

  const hasFilters = !!(search.faculty || search.department || search.level || search.semester || search.q);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-10">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Browse notes</h1>
          <p className="mt-1 text-muted-foreground">
            {notes?.length ?? 0} result{notes?.length === 1 ? "" : "s"} across the University of Bamenda
          </p>

          <form
            onSubmit={(e) => { e.preventDefault(); updateSearch({ q }); }}
            className="mt-6 flex items-center gap-2 rounded-xl border bg-background p-2 shadow-soft"
          >
            <Search className="ml-2 h-5 w-5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, course code, topic…"
              className="border-0 shadow-none focus-visible:ring-0"
            />
            <Button type="submit">Search</Button>
          </form>
        </div>
      </section>

      <div className="container mx-auto grid gap-6 px-4 py-8 md:grid-cols-[260px_1fr]">
        {/* Filters */}
        <Card className="h-fit p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold"><Filter className="h-4 w-4" /> Filters</div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={() => navigate({ search: {} as never })}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
          <div className="space-y-4">
            <FilterSelect
              label="Faculty"
              value={search.faculty}
              onChange={(v) => updateSearch({ faculty: v, department: undefined })}
              options={(faculties ?? []).map((f) => ({ value: f.slug, label: f.name }))}
            />
            <FilterSelect
              label="Department"
              value={search.department}
              onChange={(v) => updateSearch({ department: v })}
              options={(departments ?? []).map((d) => ({ value: d.slug, label: d.name }))}
            />
            <FilterSelect
              label="Level"
              value={search.level}
              onChange={(v) => updateSearch({ level: v })}
              options={LEVELS.map((l) => ({ value: l, label: `Level ${l}` }))}
            />
            <FilterSelect
              label="Semester"
              value={search.semester}
              onChange={(v) => updateSearch({ semester: v })}
              options={SEMESTERS.map((s) => ({ value: s, label: s }))}
            />
            <FilterSelect
              label="Sort by"
              value={search.sort}
              onChange={(v) => updateSearch({ sort: v as never })}
              options={[
                { value: "recent", label: "Most recent" },
                { value: "popular", label: "Most downloaded" },
                { value: "rated", label: "Highest rated" },
              ]}
            />
          </div>
        </Card>

        {/* Results */}
        <div>
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : notes && notes.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-12 text-center">
              <h3 className="font-display text-lg font-semibold">No notes match your filters</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try clearing some filters or searching for a different topic.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string | undefined; onChange: (v: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value ?? "__all"} onValueChange={(v) => onChange(v === "__all" ? undefined : v)}>
        <SelectTrigger><SelectValue placeholder={`All ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">All</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
