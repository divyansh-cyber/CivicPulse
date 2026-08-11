// ── Shared TypeScript types for CivicPulse ───────────────────────────────────
// Used by apps/web (Next.js frontend) and any TypeScript consumers.

export type Tier = "locality" | "colony" | "municipality" | "city";
export type IssueStatus = "open" | "under_review" | "approved" | "implemented" | "closed";
export type UserRole = "citizen" | "official" | "moderator";
export type ModerationStatus = "visible" | "hidden" | "under_review";
export type PollStatus = "active" | "closed";
export type DiscussionStatus = "open" | "locked";
export type VoteDirection = "up" | "down";

export interface Location {
  _id: string;
  name: string;
  tier: Tier;
  parentId: string | null;
  ancestors: string[];
  children?: Location[]; // populated in tree endpoint
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  locationId: string;
  scopeTier: Tier | null;
  elevatedSpaceIds: string[];
  createdAt: string;
}

export interface EscalationEntry {
  fromLocationId: string | Location;
  toLocationId: string | Location;
  atTier: Tier;
  movedAt: string;
  reason: string;
}

export interface Issue {
  _id: string;
  title: string;
  description: string;
  createdBy: string | User;
  originLocationId: string | Location;
  currentLocationId: string | Location;
  status: IssueStatus;
  votes: { up: number; down: number };
  slaDeadline: string;
  escalationHistory: EscalationEntry[];
  aiRiskFlag: { flagged: boolean; reason: string | null; checkedAt: string | null };
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Poll {
  _id: string;
  question: string;
  options: string[];
  locationId: string | Location;
  tier: Tier;
  createdBy: string | User;
  closesAt: string;
  status: PollStatus;
  // Enriched by API
  voteCounts?: Record<string, number>;
  totalVotes?: number;
  userVote?: string | null;
}

export interface Discussion {
  _id: string;
  title: string;
  locationId: string | Location;
  tier: Tier;
  createdBy: string | User;
  status: DiscussionStatus;
  aiSummary: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  discussionId: string;
  authorId: string | User;
  content: string;
  aiFlag: {
    toxic: boolean;
    offTopic: boolean;
    score: number;
    sentiment: number;
    checkedAt: string | null;
  };
  moderationStatus: ModerationStatus;
  createdAt: string;
}

export interface EngagementMetrics {
  _id: string;
  locationId: string | Location;
  tier: Tier;
  period: string; // "YYYY-MM-DD"
  participationCount: number;
  sentimentScore: number;
  topIssueIds: string[];
  slaBreaches: number;
  activeDiscussions: number;
  pollVoteCount: number;
  anomalyFlagged: boolean;
  anomalyReason: string | null;
  updatedAt: string;
}

export interface UptimeCheck {
  _id: string;
  endpoint: string;
  url: string;
  latencyMs: number;
  status: number;
  ok: boolean;
  checkedAt: string;
}

// API response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// Auth token payload
export interface AuthPayload {
  token: string;
  user: User;
}
