import lameJsBundleUrl from 'lamejs/lame.all.js?url';
import { MorphSettings } from '../types';

/**
 * Morphs an audio file by applying pitch shift, tempo adjustment, and other effects.
 * Returning a compressed MP3 blob of the resulting audio.
 */
export async function morphAudio(file: File, settings: MorphSettings): Promise<Blob> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // We use an OfflineAudioContext to render the modified audio faster than real-time
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.length * (1 / settings.tempo)),
    audioBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // 1. Tempo Change (PlaybackRate) - This also shifts pitch naturally
  // If we want to change pitch INDEPENDENTLY, it's much harder in pure Web Audio without a library like Tone.js
  // For this "signature morphing" app, we'll combine playbackRate with some filtering to create a unique fingerprint.
  source.playbackRate.value = settings.tempo;

  // 2. Detune (Micro-pitch shifting)
  // 100 cents = 1 semitone
  source.detune.value = settings.pitch * 100;

  // 3. Compression/Dynamics - to change the "feel"
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, offlineCtx.currentTime);
  compressor.knee.setValueAtTime(40, offlineCtx.currentTime);
  compressor.ratio.setValueAtTime(12, offlineCtx.currentTime);
  compressor.attack.setValueAtTime(0, offlineCtx.currentTime);
  compressor.release.setValueAtTime(0.25, offlineCtx.currentTime);

  // 4. Bass Boost (BiquadFilter)
  const filter = offlineCtx.createBiquadFilter();
  filter.type = 'lowshelf';
  filter.frequency.setValueAtTime(200, offlineCtx.currentTime);
  filter.gain.setValueAtTime(settings.bassBoost ? 6 : 0, offlineCtx.currentTime);

  // Connect chain
  source.connect(filter);
  filter.connect(compressor);
  compressor.connect(offlineCtx.destination);

  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();

  if (settings.removeFingerprint) {
    scrubAudioFingerprint(renderedBuffer, settings.fingerprintStrength);
  }
  
  return bufferToMp3(renderedBuffer);
}

function scrubAudioFingerprint(audioBuffer: AudioBuffer, strength: number): void {
  const normalizedStrength = clamp(strength, 0, 1);
  const noiseAmount = 0.00008 + normalizedStrength * 0.00022;
  const fadeSamples = Math.min(Math.floor(audioBuffer.sampleRate * 0.006), Math.floor(audioBuffer.length / 2));

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    let dcOffset = 0;

    for (let i = 0; i < data.length; i++) {
      dcOffset += data[i];
    }

    dcOffset /= Math.max(1, data.length);

    for (let i = 0; i < data.length; i++) {
      const fadeIn = fadeSamples > 0 && i < fadeSamples ? i / fadeSamples : 1;
      const fadeOut = fadeSamples > 0 && i > data.length - fadeSamples ? (data.length - i) / fadeSamples : 1;
      const triangularDither = (Math.random() - Math.random()) * noiseAmount;
      data[i] = clampSample((data[i] - dcOffset + triangularDither) * Math.min(fadeIn, fadeOut));
    }
  }

  if (audioBuffer.numberOfChannels > 1 && normalizedStrength > 0) {
    decorrelateStereoChannels(audioBuffer, normalizedStrength);
  }
}

function decorrelateStereoChannels(audioBuffer: AudioBuffer, strength: number): void {
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const blend = 0.0015 + strength * 0.0035;
  let previousLeft = left[0] || 0;

  for (let i = 1; i < left.length; i++) {
    const currentLeft = left[i];
    right[i] = clampSample(right[i] * (1 - blend) + previousLeft * blend);
    previousLeft = currentLeft;
  }
}

async function bufferToMp3(audioBuffer: AudioBuffer): Promise<Blob> {
  const lamejs = await loadLameJs();
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const left = convertFloat32ToInt16(audioBuffer.getChannelData(0));
  const right = channelCount === 2
    ? convertFloat32ToInt16(audioBuffer.getChannelData(1))
    : left;
  const encoder = new lamejs.Mp3Encoder(channelCount, audioBuffer.sampleRate, 192);
  const mp3Chunks: Int8Array[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < left.length; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize);
    const rightChunk = right.subarray(i, i + sampleBlockSize);
    const encoded = channelCount === 2
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk);

    if (encoded.length > 0) {
      mp3Chunks.push(encoded);
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(end);
  }

  return new Blob(mp3Chunks, { type: 'audio/mpeg' });
}

function convertFloat32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);

  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampSample(value: number): number {
  return clamp(value, -1, 1);
}

function loadLameJs(): Promise<LameJsGlobal> {
  if (window.lamejs?.Mp3Encoder) {
    return Promise.resolve(window.lamejs);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-lamejs]');

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.lamejs));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load MP3 encoder.')));
      return;
    }

    const script = document.createElement('script');
    script.src = lameJsBundleUrl;
    script.async = true;
    script.dataset.lamejs = 'true';
    script.onload = () => {
      if (window.lamejs?.Mp3Encoder) {
        resolve(window.lamejs);
      } else {
        reject(new Error('MP3 encoder loaded without Mp3Encoder.'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load MP3 encoder.'));
    document.head.appendChild(script);
  });
}
