import { AlertTriangle, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin text-muted ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted" role="status" aria-live="polite">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-surface-2/40 px-4 py-8 text-center">
      <Info className="h-5 w-5 text-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs text-muted">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  detail,
}: {
  error: string;
  onRetry?: () => void;
  detail?: string;
}) {
  const friendly =
    error === "http-500"
      ? "The server could not complete this request."
      : error.startsWith("http-")
        ? `Request failed (${error}).`
        : error === "request-failed"
          ? "The request failed. Check that the local server is still running."
          : error;
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-lg border border-danger/30 bg-red-50 px-3.5 py-3"
      role="alert"
    >
      <div className="flex items-center gap-1.5 text-sm font-medium text-danger">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        {friendly}
      </div>
      {detail ? <p className="text-xs text-danger/80">{detail}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}
