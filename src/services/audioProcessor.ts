import { MorphSettings } from './types';

/**
 * Morphs an audio file by applying pitch shift, tempo adjustment, and other effects.
 * Returning a blob of the resulting audio.
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
  
  // Convert AudioBuffer to WAV Blob
  return bufferToWav(renderedBuffer);
}

// Simple WAV encoding utility
function bufferToWav(abuffer: AudioBuffer): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952);                         // "RIFF"
  setUint32(length - 8);                         // file length - 8
  setUint32(0x45564157);                         // "WAVE"

  setUint32(0x20746d66);                         // "fmt " chunk
  setUint32(16);                                 // length = 16
  setUint16(1);                                  // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit (hardcoded)

  setUint32(0x61746164);                         // "data" - chunk
  setUint32(length - pos - 4);                   // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {             // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true);          // write 16-bit sample
      pos += 2;
    }
    offset++;                                     // next sample index
  }

  return new Blob([buffer], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
