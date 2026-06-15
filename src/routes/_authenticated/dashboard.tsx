import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download, FileText, Upload as UploadIcon, BarChart3, Clock, TrendingUp,
  MessageCircle, BookOpen, Users, Eye, Award, Sparkles, GraduationCap, Library,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NoteCard, type NoteCardData } from "@/components/NoteCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if ((roles ?? []).some((r) => r.role === "admin")) {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({ meta: [{ title: "Dashboard — NoteShare" }] }),
  component: DashboardRouter,
});

function DashboardRouter() {
  const { isLecturer, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
        <Footer />
      </div>
    );
  }
  return isLecturer ? <LecturerDashboard /> : <StudentDashboard />;
}

/* ============================================================
   STUDENT DASHBOARD — Calm, reading-focused, library aesthetic
   Capabilities: view, download, comment only.
   ============================================================ */
function StudentDashboard() {
  const { user } = useAuth();

  const { data: history } = useQuery({
    queryKey: ["student-downloads", user?.id],
    queryFn: async (): Promise<NoteCardData[]> => {
      const { data } = await supabase
        .from("download_events")
        .select("created_at, note:notes(id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,department:departments(name),course:courses(code,title))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(12);
      return ((data ?? []).map((d) => d.note).filter(Boolean) as unknown) as NoteCardData[];
    },
    enabled: !!user,
  });

  const { data: myComments } = useQuery({
    queryKey: ["student-comments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id,body,created_at,note:notes(id,title)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: trending } = useQuery({
    queryKey: ["student-trending"],
    queryFn: async (): Promise<NoteCardData[]> => {
      const { data } = await supabase
        .from("notes")
        .select("id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,department:departments(name),course:courses(code,title)")
        .eq("status", "approved")
        .order("downloads", { ascending: false })
        .limit(6);
      return (data ?? []) as unknown as NoteCardData[];
    },
  });

  const stats = {
    downloaded: history?.length ?? 0,
    comments: myComments?.length ?? 0,
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf6]">
      <Header />

      {/* Quiet reading-room hero */}
      <section className="border-b border-border/60 bg-[#fbfaf6]">
        <div className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <GraduationCap className="h-3 w-3" /> Student library
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              Good to see you back.
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Browse, read, download and discuss notes shared by your lecturers and peers at the University of Bamenda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/browse"><Button size="lg"><Library className="mr-2 h-4 w-4" /> Browse the library</Button></Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-10 px-4 py-10">
        {/* Compact reader stats */}
        <div className="grid gap-3 sm:grid-cols-2">
          <ReaderStat icon={Download} label="Notes you've downloaded" value={stats.downloaded} hint="Available to re-download anytime" />
          <ReaderStat icon={MessageCircle} label="Comments you've posted" value={stats.comments} hint="Keep the discussion going" />
        </div>

        {/* Continue reading */}
        <section>
          <SectionHeader icon={BookOpen} title="Continue where you left off" subtitle="Notes you've recently opened" />
          {history && history.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 6).map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          ) : (
            <EmptyCard message="Notes you download will appear here." cta={{ to: "/browse", label: "Find your first note" }} />
          )}
        </section>

        {/* My comments */}
        <section>
          <SectionHeader icon={MessageCircle} title="Your recent comments" subtitle="The discussions you've joined" />
          {myComments && myComments.length > 0 ? (
            <div className="space-y-2 rounded-xl border bg-card">
              {myComments.map((c) => {
                const n = (c as { note?: { id?: string; title?: string } }).note;
                return (
                  <Link
                    key={c.id}
                    to="/notes/$id"
                    params={{ id: n?.id ?? "" }}
                    className="block border-b p-4 last:border-0 hover:bg-muted/40"
                  >
                    <div className="text-xs text-muted-foreground">
                      on <span className="font-medium text-foreground">{n?.title}</span> · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{c.body}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You haven't commented yet. Open a note and start a discussion.</p>
          )}
        </section>

        {/* Trending — discovery */}
        <section>
          <SectionHeader icon={TrendingUp} title="Trending on campus" subtitle="What other students are downloading" />
          {trending && trending.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trending.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing trending yet.</p>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}

function ReaderStat({ icon: Icon, label, value, hint }: { icon: typeof Download; label: string; value: number; hint: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Download; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Icon className="h-5 w-5 text-primary" /> {title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyCard({ message, cta }: { message: string; cta?: { to: string; label: string } }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {cta && (
          <Link to={cta.to as never} className="mt-3 inline-block text-sm text-primary hover:underline">{cta.label} →</Link>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
   LECTURER DASHBOARD — Bold, analytics-driven studio
   Capabilities: upload, share, edit, see active students, downloaders
   ============================================================ */
function LecturerDashboard() {
  const { user } = useAuth();

  const { data: myNotes } = useQuery({
    queryKey: ["lec-notes", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,status,created_at,department:departments(name),course:courses(code,title)")
        .eq("uploaded_by", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const myNoteIds = (myNotes ?? []).map((n) => n.id);

  const { data: downloaders } = useQuery({
    queryKey: ["lec-downloaders", user?.id, myNoteIds.join(",")],
    queryFn: async () => {
      if (myNoteIds.length === 0) return [];
      const { data } = await supabase
        .from("download_events")
        .select("created_at,note:notes(id,title),user:profiles!download_events_user_id_fkey(id,full_name,email)")
        .in("note_id", myNoteIds)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: myNoteIds.length > 0,
  });

  const { data: recentComments } = useQuery({
    queryKey: ["lec-comments", user?.id, myNoteIds.join(",")],
    queryFn: async () => {
      if (myNoteIds.length === 0) return [];
      const { data } = await supabase
        .from("comments")
        .select("id,body,created_at,note:notes(id,title),user:profiles(full_name)")
        .in("note_id", myNoteIds)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: myNoteIds.length > 0,
  });

  // Unique active students across last 30 downloads
  const activeStudents = Array.from(
    new Map(
      (downloaders ?? [])
        .map((d) => (d as { user?: { id?: string; full_name?: string; email?: string } }).user)
        .filter((u): u is { id: string; full_name?: string; email?: string } => !!u?.id)
        .map((u) => [u.id, u])
    ).values()
  );

  const stats = {
    uploads: myNotes?.length ?? 0,
    approved: myNotes?.filter((n) => n.status === "approved").length ?? 0,
    pending: myNotes?.filter((n) => n.status === "pending").length ?? 0,
    totalDownloads: myNotes?.reduce((s, n) => s + (n.downloads ?? 0), 0) ?? 0,
    avgRating: (() => {
      const rated = (myNotes ?? []).filter((n) => (n.ratings_count ?? 0) > 0);
      if (!rated.length) return 0;
      return rated.reduce((s, n) => s + Number(n.average_rating), 0) / rated.length;
    })(),
    activeStudents: activeStudents.length,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      {/* Studio hero — dark, energetic */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="container relative mx-auto px-4 py-12">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3 w-3" /> Lecturer studio
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-bold md:text-5xl">Your teaching studio</h1>
              <p className="mt-2 max-w-xl text-white/75">Upload course notes, track who's engaging, and reply to discussions in one place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/upload"><Button size="lg" className="bg-white text-emerald-900 hover:bg-white/90"><UploadIcon className="mr-2 h-4 w-4" /> Upload notes</Button></Link>
              <Link to="/browse"><Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white">Browse library</Button></Link>
            </div>
          </div>

          {/* Inline stat strip */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StudioStat label="Uploads" value={stats.uploads} icon={UploadIcon} />
            <StudioStat label="Approved" value={stats.approved} icon={FileText} />
            <StudioStat label="Pending" value={stats.pending} icon={Clock} />
            <StudioStat label="Downloads" value={stats.totalDownloads} icon={Download} />
            <StudioStat label="Avg. rating" value={stats.avgRating.toFixed(1)} icon={Award} />
            <StudioStat label="Active students" value={stats.activeStudents} icon={Users} />
          </div>
        </div>
      </section>

      <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-3">
        {/* Left: my notes table */}
        <section className="lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
            <BarChart3 className="h-5 w-5 text-primary" /> Your uploaded notes
          </h2>
          {myNotes && myNotes.length > 0 ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-3 text-left">Note</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Downloads</th>
                    <th className="p-3 text-right">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {myNotes.map((n) => (
                    <tr key={n.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <Link to="/notes/$id" params={{ id: n.id }} className="font-medium hover:text-primary">{n.title}</Link>
                        <div className="text-xs text-muted-foreground">{n.course?.code} · Level {n.level}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={n.status === "approved" ? "default" : n.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                          {n.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right tabular-nums">{n.downloads}</td>
                      <td className="p-3 text-right tabular-nums">★ {Number(n.average_rating).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No uploads yet. <Link to="/upload" className="text-primary hover:underline">Share your first note →</Link>
            </CardContent></Card>
          )}

          {/* Recent comments on my notes */}
          <h2 className="mb-4 mt-10 flex items-center gap-2 font-display text-xl font-bold">
            <MessageCircle className="h-5 w-5 text-primary" /> Recent discussion
          </h2>
          {recentComments && recentComments.length > 0 ? (
            <div className="space-y-2 rounded-xl border bg-card">
              {recentComments.map((c) => {
                const n = (c as { note?: { id?: string; title?: string } }).note;
                const u = (c as { user?: { full_name?: string } }).user;
                return (
                  <Link key={c.id} to="/notes/$id" params={{ id: n?.id ?? "" }} className="block border-b p-4 last:border-0 hover:bg-muted/40">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{u?.full_name ?? "Student"}</span> on <span className="text-primary">{n?.title}</span> · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{c.body}</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No comments on your notes yet.</p>
          )}
        </section>

        {/* Right: students panel */}
        <aside className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-primary" /> Active students</CardTitle>
            </CardHeader>
            <CardContent>
              {activeStudents.length > 0 ? (
                <ul className="divide-y">
                  {activeStudents.slice(0, 10).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(s.full_name ?? s.email ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 text-sm">
                        <div className="truncate font-medium">{s.full_name ?? "Student"}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.email}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No active students yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Eye className="h-4 w-4 text-primary" /> Latest downloads</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {downloaders && downloaders.length > 0 ? (
                <ul className="divide-y">
                  {downloaders.slice(0, 8).map((d, i) => {
                    const u = (d as { user?: { full_name?: string; email?: string } }).user;
                    const n = (d as { note?: { title?: string } }).note;
                    return (
                      <li key={i} className="px-4 py-3 text-sm">
                        <div className="font-medium">{u?.full_name ?? u?.email ?? "Anonymous"}</div>
                        <div className="truncate text-xs text-muted-foreground">{n?.title}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">No downloads yet.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Footer />
    </div>
  );
}

function StudioStat({ icon: Icon, label, value }: { icon: typeof Download; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="flex items-center justify-between text-white/70">
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
        <Icon className="h-3 w-3" />
      </div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
