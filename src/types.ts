export interface Track {
  id: string;
  file: File;
  originalTitle: string;
  morphedTitle: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  previewUrl: string;
  durationSeconds?: number;
  morphedUrl?: string; // Blob URL of the processed audio
  robloxAssetId?: string;
  robloxModerationState?: string;
  uploadStatus?: RobloxUploadStatus;
  uploadProgress?: number;
  uploadError?: string;
  error?: string;
  settings: MorphSettings;
}

export type RobloxUploadStatus = 'idle' | 'skipped' | 'uploading' | 'processing' | 'reviewing' | 'accepted' | 'rejected' | 'error';
export type RenameMode = 'rewrite' | 'clean';

export interface MorphSettings {
  pitch: number; // -12 to 12 semitones
  tempo: number; // 0.5 to 2.0
  reverb: number; // 0 to 1
  bassBoost: boolean;
  scrubMetadata: boolean;
  renameTitle: boolean;
  renameMode: RenameMode;
  removeFingerprint: boolean;
  fingerprintStrength: number; // 0 to 1
}

export const DEFAULT_SETTINGS: MorphSettings = {
  pitch: 0.5,
  tempo: 1.02,
  reverb: 0.1,
  bassBoost: false,
  scrubMetadata: true,
  renameTitle: true,
  renameMode: 'clean',
  removeFingerprint: true,
  fingerprintStrength: 0.65
};

export interface RobloxSettings {
  enabled: boolean;
  apiKey: string;
  creatorType: 'userId' | 'groupId';
  creatorId: string;
  description: string;
}

export const DEFAULT_ROBLOX_SETTINGS: RobloxSettings = {
  enabled: false,
  apiKey: '',
  creatorType: 'userId',
  creatorId: '',
  description: 'Uploaded by SonicMorph AI'
};
