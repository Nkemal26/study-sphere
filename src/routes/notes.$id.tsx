import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Download, Flag, Heart, MessageCircle, ShieldAlert, Star, User as UserIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/notes/$id")({
  head: () => ({ meta: [{ title: "Note — NoteShare" }] }),
  component: NoteDetail,
});

const commentSchema = z.string().trim().min(1).max(1000);
const reportSchema = z.string().trim().min(3).max(500);

function NoteDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  const { data: note, isLoading } = useQuery({
    queryKey: ["note", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*,faculty:faculties(name),department:departments(name),course:courses(code,title),uploader:profiles!notes_uploaded_by_fkey(full_name,avatar_url)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id,body,created_at,user:profiles(full_name,avatar_url)")
        .eq("note_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: myRating } = useQuery({
    queryKey: ["my-rating", id, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("ratings").select("rating").eq("note_id", id).eq("user_id", user.id).maybeSingle();
      return data?.rating ?? null;
    },
    enabled: !!user,
  });

  const { data: isFav } = useQuery({
    queryKey: ["fav", id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("favorites").select("id").eq("note_id", id).eq("user_id", user.id).maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const requireAuth = () => {
    if (!user) {
      toast.error("Sign in to continue");
      navigate({ to: "/auth" });
      return false;
    }
    return true;
  };

  const handleDownload = async () => {
    if (!note) return;
    const { data, error } = await supabase.storage.from("notes").createSignedUrl(note.file_path, 60 * 5);
    if (error || !data) return toast.error("Could not generate download link");
    await supabase.from("download_events").insert({ note_id: note.id, user_id: user?.id ?? null });
    window.open(data.signedUrl, "_blank");
    queryClient.invalidateQueries({ queryKey: ["note", id] });
  };

  const handleRate = async (v: number) => {
    if (!requireAuth()) return;
    const { error } = await supabase.from("ratings").upsert({ note_id: id, user_id: user!.id, rating: v }, { onConflict: "note_id,user_id" });
    if (error) return toast.error(error.message);
    toast.success("Rating saved");
    queryClient.invalidateQueries({ queryKey: ["note", id] });
    queryClient.invalidateQueries({ queryKey: ["my-rating", id, user!.id] });
  };

  const handleFavorite = async () => {
    if (!requireAuth()) return;
    if (isFav) {
      await supabase.from("favorites").delete().eq("note_id", id).eq("user_id", user!.id);
      toast.success("Removed from favorites");
    } else {
      await supabase.from("favorites").insert({ note_id: id, user_id: user!.id });
      toast.success("Added to favorites");
    }
    queryClient.invalidateQueries({ queryKey: ["fav", id, user!.id] });
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth()) return;
    try { commentSchema.parse(comment); } catch { return toast.error("Comment must be 1-1000 chars"); }
    const { error } = await supabase.from("comments").insert({ note_id: id, user_id: user!.id, body: comment.trim() });
    if (error) return toast.error(error.message);
    setComment("");
    queryClient.invalidateQueries({ queryKey: ["comments", id] });
  };

  const handleReport = async () => {
    if (!requireAuth()) return;
    try { reportSchema.parse(reportReason); } catch { return toast.error("Reason must be 3-500 chars"); }
    const { error } = await supabase.from("reports").insert({ note_id: id, user_id: user!.id, reason: reportReason.trim() });
    if (error) return toast.error(error.message);
    setReportReason("");
    setReportOpen(false);
    toast.success("Report submitted. Thank you.");
  };

  if (isLoading || !note) {
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

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <div className="container mx-auto grid gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <main>
          <Link to="/browse" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Back to browse
          </Link>

          <Card className="overflow-hidden border-border/60">
            <div className="bg-hero p-6 text-primary-foreground md:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-white/20 text-white hover:bg-white/20">{note.file_type.toUpperCase()}</Badge>
                {note.status !== "approved" && (
                  <Badge variant="destructive" className="capitalize">{note.status}</Badge>
                )}
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{note.title}</h1>
              {note.course && (
                <p className="mt-2 text-white/80">{note.course.code} · {note.course.title}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/85">
                <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-accent text-accent" /> {Number(note.average_rating).toFixed(1)} ({note.ratings_count})</span>
                <span>·</span>
                <span className="flex items-center gap-1"><Download className="h-4 w-4" /> {note.downloads} downloads</span>
              </div>
            </div>

            <CardContent className="space-y-6 p-6 md:p-8">
              {note.description && <p className="leading-relaxed text-foreground/90">{note.description}</p>}

              <div className="flex flex-wrap gap-2">
                {note.faculty && <Badge variant="outline">{note.faculty.name}</Badge>}
                {note.department && <Badge variant="outline">{note.department.name}</Badge>}
                {note.level && <Badge variant="outline">Level {note.level}</Badge>}
                {note.semester && <Badge variant="outline">{note.semester}</Badge>}
                {note.tags?.map((t: string) => <Badge key={t} variant="secondary">#{t}</Badge>)}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-6">
                <Button onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Download</Button>
                <Button variant={isFav ? "default" : "outline"} onClick={handleFavorite}>
                  <Heart className={`mr-2 h-4 w-4 ${isFav ? "fill-current" : ""}`} /> {isFav ? "Saved" : "Save"}
                </Button>
                <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost"><Flag className="mr-2 h-4 w-4" /> Report</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report this note</DialogTitle>
                      <DialogDescription>Let admins know what's wrong. We review every report.</DialogDescription>
                    </DialogHeader>
                    <Textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="What's the issue?" maxLength={500} />
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setReportOpen(false)}>Cancel</Button>
                      <Button onClick={handleReport}><ShieldAlert className="mr-2 h-4 w-4" /> Submit report</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="rounded-xl border bg-muted/30 p-5">
                <h3 className="text-sm font-semibold">Your rating</h3>
                <p className="mb-3 text-xs text-muted-foreground">Help other students find the best material.</p>
                <StarRating value={myRating ?? 0} onChange={handleRate} />
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <MessageCircle className="h-4 w-4" /> Discussion ({comments?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user ? (
                <form onSubmit={handleComment} className="space-y-2">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" maxLength={1000} />
                  <div className="flex justify-end"><Button type="submit" size="sm">Post comment</Button></div>
                </form>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm">
                  <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to join the discussion.
                </div>
              )}

              <div className="space-y-4">
                {comments?.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {(c.user?.full_name ?? "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">{c.user?.full_name ?? "Anonymous"}</span>
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground/90">{c.body}</p>
                    </div>
                  </div>
                ))}
                {comments?.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Be the first to comment.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Uploaded by</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary"><UserIcon className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{(note as { uploader?: { full_name?: string } }).uploader?.full_name ?? "Anonymous"}</div>
                <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Footer />
    </div>
  );
}
