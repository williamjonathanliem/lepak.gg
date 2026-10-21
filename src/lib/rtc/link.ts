// One direct connection between two browsers (WebRTC), set up through a Signal.
// The initiator adds what it wants to send (video tracks, a data channel), then calls start().
// The other side answers. If the network drops, the initiator retries with an ICE restart.

/** Free public STUN servers: they only tell a browser its public address. No account needed. */
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

export interface LinkOptions {
  /** Sends a setup message to the other browser. */
  send: (t: string, d: unknown) => void;
  initiator: boolean;
  onState?: (state: RTCPeerConnectionState) => void;
}

export class PeerLink {
  readonly pc = new RTCPeerConnection(RTC_CONFIG);
  private pending: RTCIceCandidateInit[] = [];
  private restarted = false;
  private closed = false;

  constructor(private readonly opts: LinkOptions) {
    this.pc.onicecandidate = (e) => {
      if (e.candidate) opts.send('ice', e.candidate.toJSON());
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      opts.onState?.(state);
      if (state === 'connected') this.restarted = false;
      // One retry with fresh network paths, e.g. after switching Wi-Fi.
      if (state === 'failed' && opts.initiator && !this.restarted && !this.closed) {
        this.restarted = true;
        void this.offer(true);
      }
    };
  }

  /** Initiator: send the first offer. */
  start() {
    return this.offer(false);
  }

  private async offer(iceRestart: boolean) {
    const desc = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription(desc);
    this.opts.send('offer', this.pc.localDescription);
  }

  /** Feed a setup message from the other browser. */
  async handle(t: string, d: unknown) {
    if (this.closed) return;
    try {
      if (t === 'offer' || t === 'answer') {
        await this.pc.setRemoteDescription(d as RTCSessionDescriptionInit);
        for (const c of this.pending.splice(0)) await this.pc.addIceCandidate(c);
        if (t === 'offer') {
          await this.pc.setLocalDescription(await this.pc.createAnswer());
          this.opts.send('answer', this.pc.localDescription);
        }
      } else if (t === 'ice') {
        const c = d as RTCIceCandidateInit;
        if (this.pc.remoteDescription) await this.pc.addIceCandidate(c);
        else this.pending.push(c);
      }
    } catch {
      // A bad or out-of-date message; the connection state will show if it matters.
    }
  }

  close() {
    this.closed = true;
    this.pc.close();
  }
}

/** A short random id for one page load's connection attempt. */
export function newSession(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface LinkStats {
  /** Round trip in ms, or null if not known yet. */
  rttMs: number | null;
  /** True when traffic goes through a relay instead of straight between devices. */
  relay: boolean;
  /** Incoming video frames per second (viewers), or null. */
  fps: number | null;
  /** Share of packets lost, 0 to 1. */
  loss: number;
}

/** Reads the numbers behind the connection badge. */
export async function readStats(pc: RTCPeerConnection): Promise<LinkStats> {
  const report = await pc.getStats();
  let pairId: string | undefined;
  let rttMs: number | null = null;
  let relay = false;
  let fps: number | null = null;
  let lost = 0;
  let received = 0;
  report.forEach((s: Record<string, unknown>) => {
    if (s.type === 'transport' && typeof s.selectedCandidatePairId === 'string') {
      pairId = s.selectedCandidatePairId;
    }
  });
  report.forEach((s: Record<string, unknown>) => {
    const isPair =
      s.type === 'candidate-pair' &&
      (pairId ? s.id === pairId : s.nominated && s.state === 'succeeded');
    if (isPair) {
      if (typeof s.currentRoundTripTime === 'number')
        rttMs = Math.round(s.currentRoundTripTime * 1000);
      for (const key of ['localCandidateId', 'remoteCandidateId']) {
        const c = report.get(s[key] as string) as { candidateType?: string } | undefined;
        if (c?.candidateType === 'relay') relay = true;
      }
    }
    if (s.type === 'inbound-rtp' && s.kind === 'video') {
      if (typeof s.framesPerSecond === 'number') fps = s.framesPerSecond;
      lost += typeof s.packetsLost === 'number' ? s.packetsLost : 0;
      received += typeof s.packetsReceived === 'number' ? s.packetsReceived : 0;
    }
    if (s.type === 'remote-inbound-rtp' && s.kind === 'video') {
      // Host side: what the viewer reports back.
      if (typeof s.fractionLost === 'number') lost = Math.max(lost, s.fractionLost);
    }
  });
  const loss = received > 0 ? lost / (lost + received) : Math.min(1, lost);
  return { rttMs, relay, fps, loss };
}

export type Quality = 'good' | 'ok' | 'slow' | 'relay' | 'unknown';

/** Turns raw numbers into the badge people see. */
export function linkQuality(s: LinkStats | null): Quality {
  if (!s || s.rttMs === null) return 'unknown';
  if (s.relay) return 'relay';
  if (s.rttMs > 400 || s.loss > 0.08 || (s.fps !== null && s.fps < 8)) return 'slow';
  if (s.rttMs > 150 || s.loss > 0.02) return 'ok';
  return 'good';
}

export const QUALITY_LABEL: Record<Quality, string> = {
  good: 'Good',
  ok: 'OK',
  slow: 'Slow',
  relay: 'Relayed',
  unknown: 'Connecting',
};
