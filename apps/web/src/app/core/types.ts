/** One thing that happened on a device (a finished level, a saved note, a hint spent...). Append-only. */
export interface StoredEvent {
  /** Generated on the device so the server can apply a push exactly once. */
  id: string;
  deviceId: string;
  kind: string;
  payload: unknown;
  /** ISO-8601, device clock. Display only: the server never trusts it for ranking. */
  clientCreatedAt: string;
  /** Server sequence number, present once the server has the event. */
  seq?: number;
  /** 1 while the server has not accepted the event yet. Numeric because IndexedDB cannot index booleans. */
  pending: 0 | 1;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AuthSession {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AuthUser;
}

export interface PushEvent {
  id: string;
  kind: string;
  payload: unknown;
  clientCreatedAt: string;
}

export interface PushRequest {
  deviceId: string;
  platform: string;
  events: PushEvent[];
}

export interface PushResponse {
  accepted: string[];
  duplicates: string[];
  rejected: { id: string; reason: string }[];
}

export interface PulledEvent {
  seq: number;
  id: string;
  deviceId: string;
  kind: string;
  payload: unknown;
  clientCreatedAt: string;
  receivedAt: string;
}

export interface PullResponse {
  events: PulledEvent[];
  nextCursor: number;
  hasMore: boolean;
}
