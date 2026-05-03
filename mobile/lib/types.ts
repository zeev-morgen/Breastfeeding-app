export type Side = 'LEFT' | 'RIGHT' | 'BOTH';

export interface FeedingLog {
  id: string;
  userId: string;
  side: Side;
  qualityScore: number;
  durationMin: number;
  startTime: string;
  endTime: string | null;
  notes: string | null;
  source: 'APP' | 'WHATSAPP';
  createdAt: string;
  updatedAt: string;
}

export interface Guidance {
  nextSide: Side;
  nextFeedingAt: string;
  intervalHours: number;
  tip: string | null;
}

export interface CreateLogPayload {
  side: Side;
  qualityScore: number;
  durationMin: number;
  startTime?: string;
  notes?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  phoneE164: string | null;
}
