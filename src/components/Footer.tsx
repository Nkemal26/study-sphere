import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/40">
      <div className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-semibold">NoteShare</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Academic notes sharing platform for the University of Bamenda community.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Platform</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="/browse" className="hover:text-foreground">Browse notes</a></li>
            <li><a href="/upload" className="hover:text-foreground">Upload</a></li>
            <li><a href="/dashboard" className="hover:text-foreground">Dashboard</a></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Community</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Top contributors</li>
            <li>Trending notes</li>
            <li>Leaderboard</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Terms of service</li>
            <li>Privacy</li>
            <li>Report abuse</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} NoteShare · University of Bamenda
      </div>
    </footer>
  );
}
