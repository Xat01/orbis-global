import { Suspense } from "react";
import { NewsClient } from "@/components/news/NewsClient";
import { LoadingState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

export default function NewsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading news view…" />}>
      <NewsClient />
    </Suspense>
  );
}
