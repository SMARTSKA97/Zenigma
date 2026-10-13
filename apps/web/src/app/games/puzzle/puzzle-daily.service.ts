import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DeviceService } from '../../core/device.service';

export interface PuzzleAttempt {
  status: 'playing' | 'solved';
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number | null;
  rank: number | null;
  activeOnThisDevice: boolean;
  /** Sent only to the device that is playing, and only while the attempt is open. */
  puzzle: unknown | null;
  /** How many players have solved today's puzzle (for "faster than 70%"). */
  finishers?: number | null;
}

export interface PuzzleDailyState {
  date: string;
  nextRolloverUtc: string;
  attempt: PuzzleAttempt | null;
}

export type SubmitResult = { ok: true; state: PuzzleDailyState } | { ok: false; error: 'incorrect' | 'too-fast' | 'not-active-device' | 'already-finished' | 'failed' };

/** The server side of a daily grid puzzle: it reveals the puzzle, starts the clock and checks the solution. */
@Injectable({ providedIn: 'root' })
export class PuzzleDailyService {
  private readonly http = inject(HttpClient);
  private readonly device = inject(DeviceService);

  private url(game: string, path = ''): string {
    return `${environment.apiBaseUrl}/daily/${game}${path}`;
  }

  async state(game: string): Promise<PuzzleDailyState> {
    const deviceId = await this.device.deviceId();
    return firstValueFrom(this.http.get<PuzzleDailyState>(this.url(game), { params: { deviceId } }));
  }

  /** Starts today's attempt, or resumes it on this device. The clock starts at the server when the puzzle is revealed. */
  async start(game: string): Promise<PuzzleDailyState> {
    const deviceId = await this.device.deviceId();
    try {
      return await firstValueFrom(this.http.post<PuzzleDailyState>(this.url(game, '/start'), { deviceId, platform: 'web' }));
    } catch (error) {
      // "already played" and "playing elsewhere" come back with the current state.
      if (error instanceof HttpErrorResponse && error.status === 409 && error.error?.state) return error.error.state as PuzzleDailyState;
      throw error;
    }
  }

  async heartbeat(game: string): Promise<void> {
    const deviceId = await this.device.deviceId();
    await firstValueFrom(this.http.post(this.url(game, '/heartbeat'), { deviceId })).catch(() => undefined);
  }

  async submit(game: string, solution: unknown): Promise<SubmitResult> {
    const deviceId = await this.device.deviceId();
    try {
      const state = await firstValueFrom(this.http.post<PuzzleDailyState>(this.url(game, '/submit'), { deviceId, solution }));
      return { ok: true, state };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const code = error.error?.error as string | undefined;
        if (code === 'incorrect' || code === 'too-fast' || code === 'not-active-device' || code === 'already-finished') return { ok: false, error: code };
      }
      return { ok: false, error: 'failed' };
    }
  }
}
