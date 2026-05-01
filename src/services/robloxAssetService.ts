import { RobloxSettings, RobloxUploadStatus } from '../types';

const CREATE_ASSET_URL = '/api/roblox-assets';
const OPERATION_URL = '/api/roblox-operation';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

export interface RobloxUploadResult {
  assetId?: string;
  moderationState?: string;
  status: Extract<RobloxUploadStatus, 'accepted' | 'rejected'>;
  message?: string;
}

interface RobloxOperation {
  path?: string;
  done?: boolean;
  response?: {
    assetId?: string;
    moderationResult?: {
      moderationState?: string;
    };
  };
  status?: {
    code?: number;
    message?: string;
  };
}

export async function uploadAudioToRoblox(
  audioBlob: Blob,
  displayName: string,
  settings: RobloxSettings,
  onProgress?: (progress: number, status: RobloxUploadStatus) => void
): Promise<RobloxUploadResult> {
  validateSettings(settings);
  onProgress?.(5, 'uploading');

  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType: 'Audio',
    displayName: sanitizeDisplayName(displayName),
    description: settings.description.trim() || 'Uploaded by SonicMorph AI',
    creationContext: {
      creator: {
        [settings.creatorType]: settings.creatorId.trim(),
      },
      expectedPrice: 0,
    },
  }));
  form.append('fileContent', new File([audioBlob], `${sanitizeFilename(displayName)}.mp3`, { type: 'audio/mpeg' }));

  const createResponse = await fetch(CREATE_ASSET_URL, {
    method: 'POST',
    headers: {
      'x-roblox-api-key': settings.apiKey.trim(),
    },
    body: form,
  });

  const createData = await parseJsonResponse<RobloxOperation>(createResponse);
  if (!createResponse.ok) {
    throw new Error(createData?.status?.message || `Roblox upload failed: ${createResponse.status}`);
  }

  const operationPath = createData?.path;
  if (!operationPath) {
    throw new Error('Roblox did not return an upload operation id.');
  }

  onProgress?.(20, 'processing');

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const pollProgress = Math.min(95, 20 + Math.round(((attempt + 1) / MAX_POLL_ATTEMPTS) * 75));
    onProgress?.(pollProgress, 'processing');

    const operation = await getOperation(operationPath, settings.apiKey);
    if (!operation.done) continue;

    if (operation.response?.assetId) {
      const moderationState = operation.response.moderationResult?.moderationState || 'MODERATION_STATE_UNKNOWN';
      const accepted = moderationState === 'MODERATION_STATE_APPROVED';

      onProgress?.(100, accepted ? 'accepted' : 'rejected');
      return {
        assetId: operation.response.assetId,
        moderationState,
        status: accepted ? 'accepted' : 'rejected',
        message: accepted ? undefined : `Roblox moderation result: ${moderationState}`,
      };
    }

    return {
      status: 'rejected',
      message: operation.status?.message || 'Roblox rejected the asset upload.',
    };
  }

  throw new Error('Roblox upload is still processing. Try checking the asset later.');
}

async function getOperation(operationPath: string, apiKey: string): Promise<RobloxOperation> {
  const operationId = operationPath.replace(/^operations\//, '');
  const response = await fetch(`${OPERATION_URL}?operationId=${encodeURIComponent(operationId)}`, {
    headers: {
      'x-roblox-api-key': apiKey.trim(),
    },
  });

  const data = await parseJsonResponse<RobloxOperation>(response);
  if (!response.ok) {
    throw new Error(data?.status?.message || `Roblox operation check failed: ${response.status}`);
  }

  return data;
}

async function parseJsonResponse<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Roblox returned a non-JSON response: ${text.slice(0, 120)}`);
  }
}

function validateSettings(settings: RobloxSettings) {
  if (!settings.apiKey.trim()) {
    throw new Error('Roblox API key is required.');
  }

  if (!settings.creatorId.trim()) {
    throw new Error('Roblox creator user/group id is required.');
  }
}

function sanitizeDisplayName(name: string): string {
  return (name || 'SonicMorph Audio')
    .replace(/[^\w\s.'()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50) || 'SonicMorph Audio';
}

function sanitizeFilename(name: string): string {
  return sanitizeDisplayName(name)
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sonicmorph-audio';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
