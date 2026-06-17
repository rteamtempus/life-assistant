import { Injectable, signal } from '@angular/core';

/**
 * MediaRecorder spine (handoff §7). This is the cross-platform reliable path:
 * record audio → blob → upload to Storage → server-side transcription. We do
 * NOT use the Web Speech API (flaky on iOS Safari).
 *
 * iOS also requires a user gesture to unlock audio; recording is always
 * kicked off from a tap, which satisfies that.
 */
@Injectable({ providedIn: 'root' })
export class AudioRecorderService {
  readonly recording = signal(false);
  /** Elapsed seconds while recording — for a calm, non-numeric timer if wanted. */
  readonly elapsedMs = signal(0);

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;

  /** Pick a mime type the current browser actually supports. */
  private preferredMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4', // Safari/iOS
      'audio/ogg;codecs=opus',
    ];
    for (const t of candidates) {
      if (
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported(t)
      ) {
        return t;
      }
    }
    return '';
  }

  async start(): Promise<void> {
    if (this.recording()) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];

    const mimeType = this.preferredMimeType();
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType } : undefined,
    );
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();

    this.startedAt = Date.now();
    this.elapsedMs.set(0);
    this.ticker = setInterval(
      () => this.elapsedMs.set(Date.now() - this.startedAt),
      250,
    );
    this.recording.set(true);
  }

  /** Stop and resolve with the recorded audio blob (+ its mime type). */
  stop(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder;
      if (!recorder) {
        reject(new Error('Not recording.'));
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.cleanup();
        resolve({ blob, mimeType });
      };
      recorder.stop();
    });
  }

  cancel(): void {
    if (this.mediaRecorder && this.recording()) {
      this.mediaRecorder.onstop = null;
      try {
        this.mediaRecorder.stop();
      } catch {
        /* already stopped */
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.recording.set(false);
  }
}
