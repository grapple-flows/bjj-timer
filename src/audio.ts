// Timer sounds. One electronic voice, like a gym interval timer, so the
// countdown and the round signal read as one sequence:
//
//   countdown - short 1 kHz beep. Played on 3, 2, 1 before a round.
//   bell      - the same tone, a fifth higher and held for a second. Starts
//               and stops every round.
//   knock     - a short wooden knock. Played on 10, 9, 8 seconds left, the
//               same one-per-second tempo as the countdown.
//
// Everything is synthesized, so there are no audio files to host. Tones are
// a sine plus two harmonics (so they carry on phone speakers), soft-clipped
// to stay loud. Each sound is rendered once to an AudioBuffer for Web Audio.
// iOS gets an HTMLAudioElement per sound as well (more reliable with the
// silent switch), unlocked inside the first tap on Start.

type SoundId = "bell" | "knock" | "countdown";

export type TimerSounds = {
  /** Call inside a user gesture (the Start tap) so the browser allows sound. */
  unlock: () => Promise<void>;
  bell: () => void;
  knock: () => void;
  countdown: () => void;
};

const SOUND_IDS: SoundId[] = ["bell", "knock", "countdown"];

const BEEP_HZ = 1000;
const GO_HZ = 1500;
const SAMPLE_RATE = 44100;

const TONES: Record<"bell" | "countdown", { hz: number; seconds: number }> = {
  countdown: { hz: BEEP_HZ, seconds: 0.2 },
  bell: { hz: GO_HZ, seconds: 1 },
};

const getAudioContextCtor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  const extended = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? extended.webkitAudioContext ?? null;
};

const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const normalize = (data: Float32Array, drive: number, peak: number) => {
  const first = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0) || 1;
  for (let i = 0; i < data.length; i += 1) data[i] = Math.tanh((data[i] / first) * drive);
  const second = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0) || 1;
  for (let i = 0; i < data.length; i += 1) data[i] *= peak / second;
};

/** The timer's tone: a sine with two harmonics, fast attack, flat sustain,
 *  short release, soft-clipped and normalized to near full scale. */
export const renderTone = async (hz: number, seconds: number, sampleRate = SAMPLE_RATE): Promise<AudioBuffer> => {
  const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * (seconds + 0.01)), sampleRate);
  const env = offline.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(1, 0.005);
  env.gain.setValueAtTime(1, seconds - 0.04);
  env.gain.linearRampToValueAtTime(0, seconds - 0.01);
  env.connect(offline.destination);
  for (const [ratio, level] of [
    [1, 1],
    [2, 0.3],
    [3, 0.15],
  ]) {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.frequency.value = hz * ratio;
    gain.gain.value = level;
    osc.connect(gain);
    gain.connect(env);
    osc.start(0);
    osc.stop(seconds);
  }
  const rendered = await offline.startRendering();
  normalize(rendered.getChannelData(0), 2.5, 0.9);
  return rendered;
};

/** A dry wooden knock: two inharmonic partials with a fast decay and a short
 *  band-passed noise click for the attack. */
export const renderKnock = async (sampleRate = SAMPLE_RATE): Promise<AudioBuffer> => {
  const seconds = 0.14;
  const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * seconds), sampleRate);

  for (const [hz, level, decay] of [
    [820, 1, 0.045],
    [2150, 0.45, 0.02],
  ]) {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.type = "sine";
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(level, 0.002);
    gain.gain.setTargetAtTime(0, 0.002, decay / 3);
    osc.connect(gain);
    gain.connect(offline.destination);
    osc.start(0);
    osc.stop(seconds);
  }

  const noiseLength = Math.ceil(sampleRate * 0.012);
  const noise = offline.createBuffer(1, noiseLength, sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength);
  const source = offline.createBufferSource();
  const filter = offline.createBiquadFilter();
  const noiseGain = offline.createGain();
  source.buffer = noise;
  filter.type = "bandpass";
  filter.frequency.value = 1800;
  filter.Q.value = 2;
  noiseGain.gain.value = 0.6;
  source.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  normalize(rendered.getChannelData(0), 1.8, 0.9);
  return rendered;
};

export const encodeWav = (buffer: AudioBuffer): ArrayBuffer => {
  const channel = buffer.getChannelData(0);
  const dataLength = channel.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataLength));
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let i = 0; i < channel.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return view.buffer;
};

export const createTimerSounds = (): TimerSounds => {
  const AudioContextCtor = getAudioContextCtor();
  const preferHtml = isIOS();
  let context: AudioContext | null = null;
  const buffers: Partial<Record<SoundId, Promise<AudioBuffer | null>>> = {};
  const players: Partial<Record<SoundId, HTMLAudioElement>> = {};

  const getContext = (): AudioContext | null => {
    if (!AudioContextCtor) return null;
    if (!context || context.state === "closed") context = new AudioContextCtor();
    return context;
  };

  const ensureRunning = async (): Promise<AudioContext | null> => {
    const active = getContext();
    if (!active) return null;
    if (active.state === "suspended") {
      try {
        await active.resume();
      } catch {
        /* needs a user gesture; the next tap will resume it */
      }
    }
    return active;
  };

  const makePlayer = (id: SoundId, buffer: AudioBuffer) => {
    if (!preferHtml || typeof Audio === "undefined" || players[id]) return;
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return;
    const player = new Audio(URL.createObjectURL(new Blob([encodeWav(buffer)], { type: "audio/wav" })));
    player.setAttribute("playsinline", "true");
    player.preload = "auto";
    players[id] = player;
  };

  const getBuffer = (id: SoundId): Promise<AudioBuffer | null> => {
    buffers[id] ??= (async () => {
      try {
        // Render offline: no live AudioContext (and no autoplay warning)
        // before the first tap. AudioBuffers play in any context.
        if (typeof OfflineAudioContext === "undefined") return null;
        const buffer = id === "knock" ? await renderKnock() : await renderTone(TONES[id].hz, TONES[id].seconds);
        makePlayer(id, buffer);
        return buffer;
      } catch {
        delete buffers[id];
        return null;
      }
    })();
    return buffers[id] as Promise<AudioBuffer | null>;
  };

  const prepare = () => SOUND_IDS.forEach((id) => void getBuffer(id));

  const playBuffer = async (id: SoundId) => {
    const [active, buffer] = await Promise.all([ensureRunning(), getBuffer(id)]);
    if (!active || !buffer) return;
    const source = active.createBufferSource();
    source.buffer = buffer;
    source.connect(active.destination);
    source.start();
  };

  const play = (id: SoundId) => {
    const player = players[id];
    if (preferHtml && player) {
      player.currentTime = 0;
      player.volume = 1;
      void player.play()?.catch(() => void playBuffer(id));
      return;
    }
    void playBuffer(id);
  };

  // Render up front so the first tap only has to unlock, not render: iOS
  // drops the gesture if unlock() waits too long before play().
  if (typeof window !== "undefined") prepare();

  return {
    unlock: async () => {
      const active = await ensureRunning();
      if (active) {
        // A silent buffer inside the gesture unlocks Web Audio on Safari.
        const silent = active.createBuffer(1, 1, active.sampleRate);
        const source = active.createBufferSource();
        source.buffer = silent;
        source.connect(active.destination);
        source.start(0);
      }
      if (!preferHtml) {
        await Promise.all(SOUND_IDS.map(getBuffer));
        return;
      }
      // iOS only unlocks the *same* HTMLAudioElement that played during a gesture.
      await Promise.all(
        SOUND_IDS.map(async (id) => {
          const player = players[id];
          if (!player) return;
          try {
            player.volume = 0.001;
            await player.play();
            player.pause();
            player.currentTime = 0;
          } catch {
            /* falls back to Web Audio at play time */
          } finally {
            player.volume = 1;
          }
        }),
      );
    },
    bell: () => play("bell"),
    knock: () => play("knock"),
    countdown: () => play("countdown"),
  };
};

let shared: TimerSounds | null = null;

/** One sound bank per page, shared by every timer on it. */
export const getTimerSounds = (): TimerSounds => {
  shared ??= createTimerSounds();
  return shared;
};
