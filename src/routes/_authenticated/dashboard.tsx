import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Heart, Upload as UploadIcon, BarChart3, Clock, TrendingUp } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NoteCard, type NoteCardData } from "@/components/NoteCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NoteShare" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, isLecturer, isAdmin, isStudent } = useAuth();
  const canUpload = isLecturer || isAdmin;

  const { data: myNotes } = useQuery({
    queryKey: ["my-notes", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,status,department:departments(name),course:courses(code,title)")
        .eq("uploaded_by", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user && canUpload,
  });

  const myNoteIds = (myNotes ?? []).map((n) => n.id);

  const { data: downloaders } = useQuery({
    queryKey: ["downloaders", user?.id, myNoteIds.join(",")],
    queryFn: async () => {
      if (myNoteIds.length === 0) return [];
      const { data } = await supabase
        .from("download_events")
        .select("created_at,note:notes(id,title),user:profiles!download_events_user_id_fkey(id,full_name,email)")
        .in("note_id", myNoteIds)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: canUpload && myNoteIds.length > 0,
  });

  const { data: favorites } = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: async (): Promise<NoteCardData[]> => {
      const { data } = await supabase
        .from("favorites")
        .select("note:notes(id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,department:departments(name),course:courses(code,title))")
        .eq("user_id", user!.id);
      return ((data ?? []).map((f) => f.note).filter(Boolean) as unknown) as NoteCardData[];
    },
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ["download-history", user?.id],
    queryFn: async (): Promise<NoteCardData[]> => {
      const { data } = await supabase
        .from("download_events")
        .select("created_at, note:notes(id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,department:departments(name),course:courses(code,title))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      return ((data ?? []).map((d) => d.note).filter(Boolean) as unknown) as NoteCardData[];
    },
    enabled: !!user,
  });

  const { data: lecturerDownloads } = useQuery({
    queryKey: ["lecturer-downloads", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("download_events")
        .select(`
          created_at,
          note:notes!inner(id,title),
          user:profiles!left(full_name, email)
        `)
        .eq("notes.uploaded_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!user && isLecturer,
  });

  const stats = {
    uploads: myNotes?.length ?? 0,
    approved: myNotes?.filter((n) => n.status === "approved").length ?? 0,
    pending: myNotes?.filter((n) => n.status === "pending").length ?? 0,
    totalDownloads: myNotes?.reduce((s, n) => s + (n.downloads ?? 0), 0) ?? 0,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <section className="bg-hero text-primary-foreground">
        <div className="container mx-auto px-4 py-10">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Welcome back 👋</h1>
          <p className="mt-1 text-white/80">{user?.email}</p>
        </div>
      </section>

      <div className="container mx-auto space-y-8 px-4 py-8">
        {/* Stat cards */}
        {canUpload && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={UploadIcon} label="Your uploads" value={stats.uploads} />
            <StatCard icon={FileText} label="Approved" value={stats.approved} />
            <StatCard icon={Clock} label="Pending review" value={stats.pending} />
            <StatCard icon={Download} label="Total downloads" value={stats.totalDownloads} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canUpload && (
            <Link to="/upload"><Button><UploadIcon className="mr-2 h-4 w-4" /> Upload new notes</Button></Link>
          )}
          <Link to="/browse"><Button variant="outline">Browse all notes</Button></Link>
          {!isStudent && (
            <Link to="/favorites"><Button variant="ghost"><Heart className="mr-2 h-4 w-4" /> Favorites</Button></Link>
          )}
        </div>

        {/* My uploads (lecturers/admins) */}
        {canUpload && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <BarChart3 className="h-5 w-5 text-primary" /> Your uploaded notes
            </h2>
            {myNotes && myNotes.length > 0 ? (
              <div className="space-y-2 rounded-xl border bg-card">
                {myNotes.map((n) => (
                  <Link key={n.id} to="/notes/$id" params={{ id: n.id }} className="flex items-center justify-between gap-3 border-b p-4 last:border-0 hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{n.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          n.status === "approved" ? "bg-success/20 text-success" :
                          n.status === "rejected" ? "bg-destructive/20 text-destructive" :
                          "bg-warning/20 text-warning"
                        }`}>{n.status}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {n.course?.code} · {n.department?.name} · Level {n.level}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {n.downloads}</span>
                      <span>★ {Number(n.average_rating).toFixed(1)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                You haven't uploaded any notes yet. <Link to="/upload" className="text-primary hover:underline">Upload your first one →</Link>
              </CardContent></Card>
            )}
          </section>
        )}

        {/* Downloaders (lecturers/admins) */}
        {canUpload && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Download className="h-5 w-5 text-primary" /> Students who downloaded your notes
            </h2>
            {downloaders && downloaders.length > 0 ? (
              <div className="space-y-1 rounded-xl border bg-card">
                {downloaders.map((d, i) => {
                  const u = (d as { user?: { full_name?: string; email?: string } }).user;
                  const n = (d as { note?: { title?: string } }).note;
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 border-b p-3 last:border-0 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{u?.full_name || u?.email || "Unknown"}</div>
                        <div className="truncate text-xs text-muted-foreground">{n?.title}</div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No downloads yet.</p>
            )}
          </section>
        )}


        {/* Favorites */}
        {!isStudent && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Heart className="h-5 w-5 text-primary" /> Your favorites
            </h2>
            {favorites && favorites.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favorites.slice(0, 6).map((n) => <NoteCard key={n.id} note={n} />)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No favorites yet. Save notes you want to come back to.</p>
            )}
          </section>
        )}

        {/* Lecturer specific: Students who downloaded my notes */}
        {isLecturer && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
              <Download className="h-5 w-5 text-primary" /> Students who downloaded your notes
            </h2>
            {lecturerDownloads && lecturerDownloads.length > 0 ? (
              <div className="space-y-2 rounded-xl border bg-card">
                {lecturerDownloads.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-3 border-b p-4 last:border-0 hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="font-semibold">{d.note?.title}</div>
                      <div className="text-xs text-muted-foreground">
                        Downloaded by: {d.user?.full_name || d.user?.email || "Anonymous Student"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No downloads of your notes yet.</p>
            )}
          </section>
        )}

        {/* Recently downloaded */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold">
            <TrendingUp className="h-5 w-5 text-primary" /> Recently downloaded
          </h2>
          {history && history.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 6).map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Notes you download will appear here.</p>
          )}
        </section>
      </div>

      <Footer />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Download; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}
