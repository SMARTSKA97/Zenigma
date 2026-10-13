import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Circle {
  id: string;
  name: string;
  code: string;
  isOwner: boolean;
  members: number;
}

export interface CircleToday {
  id: string;
  name: string;
  friends: { name: string; solved: number }[];
}

export interface SeasonEntry {
  name: string;
  solved: number;
  isMe: boolean;
}
export interface Season {
  /** "2026-10". */
  label: string;
  circles: { id: string; name: string; top: SeasonEntry[] }[];
}
export interface Seasons {
  current: Season;
  previous: Season;
}

/** Private friend groups with their own leaderboards. */
@Injectable({ providedIn: 'root' })
export class CirclesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/circles`;

  list(): Promise<Circle[]> {
    return firstValueFrom(this.http.get<Circle[]>(this.base));
  }
  /** Which friends in my circles played today's dailies. */
  today(): Promise<CircleToday[]> {
    return firstValueFrom(this.http.get<CircleToday[]>(`${this.base}/today`));
  }
  /** This month's circle tables and last month's podiums. */
  seasons(): Promise<Seasons> {
    return firstValueFrom(this.http.get<Seasons>(`${this.base}/seasons`));
  }
  create(name: string): Promise<Circle> {
    return firstValueFrom(this.http.post<Circle>(this.base, { name }));
  }
  join(code: string): Promise<Circle> {
    return firstValueFrom(this.http.post<Circle>(`${this.base}/join`, { code }));
  }
  leave(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}

export function inviteLink(code: string): string {
  return `https://zenigma.ska97homelab.uk/ranks/circles?join=${code}`;
}
