import { Link } from "@tanstack/react-router";
import { FileText, Download, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface NoteCardData {
  id: string;
  title: string;
  description: string | null;
  file_type: string;
  level: string | null;
  semester: string | null;
  downloads: number;
  average_rating: number;
  ratings_count: number;
  faculty?: { name: string } | null;
  department?: { name: string } | null;
  course?: { code: string; title: string } | null;
}

export function NoteCard({ note }: { note: NoteCardData }) {
  return (
    <Link to="/notes/$id" params={{ id: note.id }}>
      <Card className="group h-full overflow-hidden border-border/60 bg-card-gradient transition-all hover:-translate-y-1 hover:shadow-lifted">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <Badge variant="secondary" className="uppercase">{note.file_type}</Badge>
          </div>
          <div>
            <h3 className="line-clamp-2 font-display text-base font-semibold leading-tight group-hover:text-primary">
              {note.title}
            </h3>
            {note.course && (
              <p className="mt-1 text-xs text-muted-foreground">
                {note.course.code} · {note.course.title}
              </p>
            )}
          </div>
          {note.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{note.description}</p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            {note.department && <Badge variant="outline" className="text-[10px]">{note.department.name}</Badge>}
            {note.level && <Badge variant="outline" className="text-[10px]">{note.level}</Badge>}
            {note.semester && <Badge variant="outline" className="text-[10px]">{note.semester}</Badge>}
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {Number(note.average_rating).toFixed(1)} ({note.ratings_count})
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" /> {note.downloads}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
