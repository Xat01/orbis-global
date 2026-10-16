"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Button } from "@/components/ui/Button";

export function SaveButton({
  item,
}: {
  item: {
    id: string;
    kind: "event" | "article";
    title: string;
    url: string | null;
    snippet: string;
  };
}) {
  const { toggleSaved, isSaved, hydrated } = usePreferences();
  const saved = hydrated && isSaved(item.id);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        toggleSaved(item);
      }}
      aria-pressed={saved}
      title={saved ? "Remove from saved items" : "Save for later"}
    >
      {saved ? <BookmarkCheck className="h-3.5 w-3.5 text-accent" /> : <Bookmark className="h-3.5 w-3.5" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
