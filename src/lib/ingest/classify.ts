import type { Topic } from "@/lib/types";

// ---------------------------------------------------------------------------
// Deterministic topic classification from headline/description keywords.
// Rules are transparent (documented on the Sources & Methodology page).
// An article may carry several topics.
// ---------------------------------------------------------------------------

interface TopicRule {
  topic: Topic;
  patterns: RegExp[];
}

const RULES: TopicRule[] = [
  {
    topic: "natural-disaster",
    patterns: [
      /\bearthquake\b/i, /\bmagnitude\b/i, /\btsunami\b/i, /\bcyclone\b/i,
      /\bhurricane\b/i, /\btyphoon\b/i, /\bvolcano\b/i, /\beruption\b/i,
      /\bfloods?\b/i, /\blandslide\b/i, /\bavalanche\b/i, /\bdrought\b/i,
      /\bwildfire\b/i, /\bearthquake\b/i, /\baftershock\b/i, /\bmagnitude\b/i,
    ],
  },
  {
    topic: "armed-conflict",
    patterns: [
      /\bairstrike\b/i, /\bair strike\b/i, /\bmissile\b/i, /\bshelling\b/i,
      /\bgunfire\b/i, /\bceasefire\b/i, /\bwar\b/i, /\binvasion\b/i,
      /\btroops?\b/i, /\bmilitary\b/i, /\barmy\b/i, /\bcombat\b/i,
      /\bresistance\b/i, /\bmilitia\b/i, /\binsurgents?\b/i, /\bdrone strike\b/i,
      /\bkilled\b/i, /\bbombing\b/i, /\bfront line\b/i, /\battack(?:ed|s)?\b/i,
      /\bhezbollah\b/i, /\bhamas\b/i, /\bforces?\b/i,
    ],
  },
  {
    topic: "cybersecurity",
    patterns: [
      /\bcyber\b/i, /\bhack(?:ed|ers?|ing)?\b/i, /\bransomware\b/i, /\bmalware\b/i,
      /\bdata breach\b/i, /\bbreach\b/i, /\bzero-day\b/i, /\bCVE-\d/i,
      /\bvulnerabilit(?:y|ies)\b/i, /\bphishing\b/i, /\bspyware\b/i,
      /\bnorth korea(?:n)?\b.*\bcrypto/i, /\bexploit\b/i,
    ],
  },
  {
    topic: "public-health",
    patterns: [
      /\boutbreak\b/i, /\epidemic\b/i, /\bpandemic\b/i, /\bvaccine\b/i,
      /\bwho\b/i, /\bhealth (?:ministry|officials?)\b/i, /\bcholera\b/i,
      /\bmalaria\b/i, /\bdengue\b/i, /\bmeasles\b/i, /\bvirus\b/i,
      /\bmortality\b/i, /\binfectious\b/i,
    ],
  },
  {
    topic: "economics",
    patterns: [
      /\binflation\b/i, /\binterest rate\b/i, /\bcentral bank\b/i, /\bfed\b/i,
      /\becb\b/i, /\btariff\b/i, /\bsanctions?\b/i, /\bgdp\b/i, /\bmarkets?\b/i,
      /\bstocks?\b/i, /\brecession\b/i, /\bcurrency\b/i, /\bdebt\b/i,
      /\btrade (?:deal|talks|war)\b/i, /\boil prices?\b/i, /\brecession\b/i,
      /\bbudget\b/i, /\bexports?\b/i, /\bimports?\b/i,
    ],
  },
  {
    topic: "diplomacy",
    patterns: [
      /\bsummit\b/i, /\btalks?\b/i, /\bnegotiations?\b/i, /\benvoys?\b/i,
      /\bdiplomat\b/i, /\btreaty\b/i, /\bagreement\b/i, /\bcease-?fire talks\b/i,
      /\bun security council\b/i, /\bresolution\b/i, /\bbilateral\b/i,
      /\bembassy\b/i, /\bambassador\b/i, /\bvisit(?:ing)?\b/i, /\bconference\b/i,
    ],
  },
  {
    topic: "technology",
    patterns: [
      /\bai\b/i, /\bartificial intelligence\b/i, /\bsemiconductor\b/i,
      /\bchip\b/i, /\bspacex\b/i, /\bsatellite\b/i, /\blaunch(?:ed)?\b/i,
      /\bstartup\b/i, /\bregulation of tech\b/i, /\bdata cent(?:er|re)\b/i,
    ],
  },
  {
    topic: "infrastructure",
    patterns: [
      /\bpower (?:grid|outage|line)\b/i, /\bblackout\b/i, /\bpipeline\b/i,
      /\bdam\b/i, /\bbridge\b/i, /\bport\b/i, /\bgrid\b/i, /\binternet (?:outage|shutdown)\b/i,
      /\bsubsea cable\b/i, /\btelecom\b/i, /\bnuclear plant\b/i,
    ],
  },
  {
    topic: "transportation",
    patterns: [
      /\bairline\b/i, /\bflight(?:s)?\b/i, /\bairport\b/i, /\brail(?:way)?\b/i,
      /\bshipping\b/i, /\bvessel\b/i, /\bcargo\b/i, /\bcrash(?:ed)?\b/i,
      /\bcollision\b/i, /\bcanal\b/i, /\bstrait\b/i,
    ],
  },
  {
    topic: "environment",
    patterns: [
      /\bclimate\b/i, /\bemissions?\b/i, /\bdeforestation\b/i, /\bpollution\b/i,
      /\bconservation\b/i, /\bbiodiversity\b/i, /\bcoral\b/i, /\bplastic\b/i,
      /\bcarbon\b/i, /\bparis agreement\b/i,
    ],
  },
  {
    topic: "weather",
    patterns: [
      /\bheatwave\b/i, /\bheat wave\b/i, /\bcold snap\b/i, /\bstorm\b/i,
      /\bblizzard\b/i, /\btornado\b/i, /\bdownpour\b/i, /\bwarnings?\b/i,
      /\btemperatures?\b/i, /\bweather\b/i,
    ],
  },
  {
    topic: "geopolitics",
    patterns: [
      /\belection\b/i, /\bprotest(?:s|ers)?\b/i, /\bcoup\b/i, /\bgovernment\b/i,
      /\bpresident\b/i, /\bprime minister\b/i, /\bparliament\b/i, /\bsanction\b/i,
      /\bterritor(?:y|ies)\b/i, /\bsovereignty\b/i, /\bborder\b/i,
    ],
  },
];

export function classifyTopics(text: string): Topic[] {
  const hits = new Set<Topic>();
  for (const rule of RULES) {
    for (const p of rule.patterns) {
      if (p.test(text)) {
        hits.add(rule.topic);
        break;
      }
    }
  }
  if (hits.size === 0) hits.add("geopolitics"); // sensible default for world news
  return [...hits];
}
