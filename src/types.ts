export interface Track {
  id: string;
  file: File;
  originalTitle: string;
  morphedTitle: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  previewUrl: string;
  morphedUrl?: string; // Blob URL of the processed audio
  error?: string;
  settings: MorphSettings;
}

export interface MorphSettings {
  pitch: number; // -12 to 12 semitones
  tempo: number; // 0.5 to 2.0
  reverb: number; // 0 to 1
  bassBoost: boolean;
  scrubMetadata: boolean;
}

export const DEFAULT_SETTINGS: MorphSettings = {
  pitch: 0.5,
  tempo: 1.02,
  reverb: 0.1,
  bassBoost: false,
  scrubMetadata: true
};
