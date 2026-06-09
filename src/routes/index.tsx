import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BookOpen, Download, FileText, Search, Sparkles, Star, Upload, Users } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NoteCard, type NoteCardData } from "@/components/NoteCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NoteShare — Academic Notes Sharing for University of Bamenda" },
      { name: "description", content: "Find, upload and share lecture notes across every faculty at the University of Bamenda. Search by course, department, level and semester." },
      { property: "og:title", content: "NoteShare — Academic Notes for UBa" },
      { property: "og:description", content: "The University of Bamenda's notes-sharing platform for students and lecturers." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data: featured } = useQuery({
    queryKey: ["featured-notes"],
    queryFn: async (): Promise<NoteCardData[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,faculty:faculties(name),department:departments(name),course:courses(code,title)")
        .eq("status", "approved")
        .order("downloads", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as NoteCardData[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [notes, users, downloads] = await Promise.all([
        supabase.from("notes").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("download_events").select("id", { count: "exact", head: true }),
      ]);
      return {
        notes: notes.count ?? 0,
        users: users.count ?? 0,
        downloads: downloads.count ?? 0,
      };
    },
  });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/browse", search: { q } as never });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Hero */}
      <section className="bg-hero relative overflow-hidden text-primary-foreground">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute bottom-0 -left-32 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        </div>
        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3 w-3" /> Built for the University of Bamenda
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-tight md:text-6xl">
              All your lecture notes,<br />
              <span className="text-accent">one shared library.</span>
            </h1>
            <p className="mt-5 text-base text-white/80 md:text-lg">
              Discover notes from every faculty. Upload yours, rate the best, and never miss a lecture again.
            </p>

            <form onSubmit={onSearch} className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-xl bg-white p-2 shadow-lifted">
              <Search className="ml-2 h-5 w-5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search course code, topic, or department…"
                className="border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="lg">Search</Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <Link to="/browse">
                <Button variant="secondary" size="lg" className="bg-white/10 text-white hover:bg-white/20">
                  Browse notes <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "signup" } as never}>
                <Button variant="ghost" size="lg" className="text-white hover:bg-white/10 hover:text-white">
                  <Upload className="mr-2 h-4 w-4" /> Share your notes
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/60 bg-card">
        <div className="container mx-auto grid grid-cols-3 gap-6 px-4 py-10 text-center md:gap-12">
          {[
            { label: "Notes shared", value: stats?.notes ?? 0, icon: FileText },
            { label: "Active learners", value: stats?.users ?? 0, icon: Users },
            { label: "Downloads", value: stats?.downloads ?? 0, icon: Download },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="font-display text-3xl font-bold">{s.value.toLocaleString()}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold">Featured notes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Most downloaded across all faculties this week.</p>
          </div>
          <Link to="/browse" className="hidden text-sm font-medium text-primary hover:underline md:inline">
            View all →
          </Link>
        </div>

        {featured && featured.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((n) => <NoteCard key={n.id} note={n} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">No approved notes yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Be the first lecturer or student to share your notes with the community.</p>
            <Link to="/auth" search={{ mode: "signup" } as never}>
              <Button className="mt-5"><Upload className="mr-2 h-4 w-4" /> Upload notes</Button>
            </Link>
          </div>
        )}
      </section>

      {/* Features */}
      <section className="bg-muted/40 py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold">Everything you need to study smarter</h2>
            <p className="mt-2 text-muted-foreground">A modern academic library tailored to the University of Bamenda.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: Search, title: "Smart search & filters", body: "Find notes by course code, faculty, department, level, semester, or popularity in seconds." },
              { icon: Star, title: "Ratings & reviews", body: "Vote up the clearest, most accurate notes so the best material rises to the top." },
              { icon: Upload, title: "Easy uploads", body: "PDF, DOCX, PPT, ZIP — share your notes with version control and download analytics." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-hero relative overflow-hidden rounded-3xl px-8 py-14 text-center text-primary-foreground shadow-lifted md:px-16">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Ready to contribute?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Join lecturers and students across UBa already sharing their best material on NoteShare.
          </p>
          <Link to="/auth" search={{ mode: "signup" } as never}>
            <Button size="lg" variant="secondary" className="mt-6 bg-white text-primary hover:bg-white/90">
              Create your free account <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
