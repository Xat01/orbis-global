import type { EvidenceLabel, SignificanceLevel } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const LEVEL_TONE: Record<SignificanceLevel, "red" | "amber" | "neutral"> = {
  critical: "red",
  notable: "amber",
  routine: "neutral",
};

export function SignificanceBadge({ level }: { level: SignificanceLevel }) {
  return (
    <Badge tone={LEVEL_TONE[level]} title={`ORBIS significance level: ${level}`}>
      {level}
    </Badge>
  );
}

const LABEL_TEXT: Record<EvidenceLabel, string> = {
  "multiple-sources-agree": "multiple sources agree",
  "single-source": "single-source report",
  "official-statement": "official statement",
  developing: "developing",
  "conflicting-accounts": "conflicting reports",
  unverified: "unverified claim",
  "corrected-or-retracted": "corrected or retracted",
};

const LABEL_TONE: Record<EvidenceLabel, "green" | "amber" | "blue" | "red" | "neutral"> = {
  "multiple-sources-agree": "green",
  "single-source": "amber",
  "official-statement": "blue",
  developing: "blue",
  "conflicting-accounts": "amber",
  unverified: "red",
  "corrected-or-retracted": "red",
};

export function EvidenceBadge({ label }: { label: EvidenceLabel }) {
  return <Badge tone={LABEL_TONE[label]}>{LABEL_TEXT[label]}</Badge>;
}
