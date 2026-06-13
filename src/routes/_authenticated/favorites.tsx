import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useEffect } from "react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NoteCard, type NoteCardData } from "@/components/NoteCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — NoteShare" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, isStudent, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isStudent) {
      navigate({ to: "/dashboard" });
    }
  }, [isStudent, loading, navigate]);
  const { data } = useQuery({
    queryKey: ["favorites-full", user?.id],
    queryFn: async (): Promise<NoteCardData[]> => {
      const { data } = await supabase
        .from("favorites")
        .select("created_at, note:notes(id,title,description,file_type,level,semester,downloads,average_rating,ratings_count,department:departments(name),course:courses(code,title))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return ((data ?? []).map((f) => f.note).filter(Boolean) as unknown) as NoteCardData[];
    },
    enabled: !!user,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto px-4 py-10">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <Heart className="h-6 w-6 fill-primary text-primary" /> Your favorites
        </h1>
        <p className="mt-1 text-muted-foreground">Notes you've saved for later.</p>

        <div className="mt-8">
          {data && data.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-12 text-center">
              <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-display text-lg font-semibold">No favorites yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tap the heart on any note to save it here.</p>
              <Link to="/browse"><Button className="mt-5">Browse notes</Button></Link>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
