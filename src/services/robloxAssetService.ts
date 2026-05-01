import { RobloxSettings, RobloxUploadStatus } from '../types';

const CREATE_ASSET_URL = '/api/roblox-assets';
const OPERATION_URL = '/api/roblox-operation';
const ASSET_PERMISSIONS_URL = '/api/roblox-asset-permissions';
const POLL_INTERVAL_MS = 60_000;

export interface RobloxUploadResult {
  assetId?: string;
  moderationState?: string;
  operationPath?: string;
  status: Extract<RobloxUploadStatus, 'processing' | 'accepted' | 'reviewing' | 'rejected'>;
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

export type RobloxAssetPermissionSubject = 'Universe' | 'User';

export interface RobloxAssetPermissionResult {
  successAssetIds?: number[];
  errors?: unknown[];
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
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
  return {
    operationPath,
    status: 'processing',
    message: 'Roblox accepted the upload request. Waiting for asset processing.',
  };
}

export async function monitorRobloxModeration(
  operationPath: string,
  apiKey: string,
  onUpdate: (result: RobloxUploadResult) => void
): Promise<RobloxUploadResult> {
  while (true) {
    await sleep(POLL_INTERVAL_MS);

    const operation = await getOperation(operationPath, apiKey);
    if (!operation.response?.assetId) {
      onUpdate({
        operationPath,
        status: 'processing',
        message: operation.status?.message || 'Roblox is still processing this upload.',
      });
      continue;
    }

    const moderationState = operation.response.moderationResult?.moderationState || 'MODERATION_STATE_UNKNOWN';
    const moderationStatus = getModerationStatus(moderationState);
    const result: RobloxUploadResult = {
      assetId: operation.response.assetId,
      moderationState,
      operationPath,
      status: moderationStatus,
      message: moderationStatus === 'reviewing'
        ? 'Roblox is reviewing this asset.'
        : moderationStatus === 'accepted'
          ? undefined
          : `Roblox moderation result: ${moderationState}`,
    };

    onUpdate(result);

    if (moderationStatus !== 'reviewing') {
      return result;
    }
  }
}

export async function grantRobloxAssetPermissions(
  apiKey: string,
  assetIds: string[],
  subjectType: RobloxAssetPermissionSubject,
  subjectId: string
): Promise<RobloxAssetPermissionResult> {
  if (!apiKey.trim()) {
    throw new Error('Roblox API key is required.');
  }

  const cleanedAssetIds = assetIds
    .map(assetId => assetId.trim())
    .filter(Boolean);

  if (cleanedAssetIds.length === 0) {
    throw new Error('Select at least one Roblox asset.');
  }

  if (!subjectId.trim()) {
    throw new Error(`${subjectType === 'Universe' ? 'Experience / Universe' : 'User'} ID is required.`);
  }

  const response = await fetch(ASSET_PERMISSIONS_URL, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-roblox-api-key': apiKey.trim(),
    },
    body: JSON.stringify({
      subjectType,
      subjectId: subjectId.trim(),
      action: 'Use',
      enableDeepAccessCheck: true,
      requests: cleanedAssetIds.map(assetId => ({
        assetId: Number(assetId),
        grantToDependencies: true,
      })),
    }),
  });

  const data = await parseJsonResponse<RobloxAssetPermissionResult>(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Roblox permission grant failed: ${response.status}`);
  }

  return data || { message: 'Roblox accepted the permission request.' };
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

function getModerationStatus(moderationState: string): Extract<RobloxUploadStatus, 'accepted' | 'reviewing' | 'rejected'> {
  const state = moderationState.toUpperCase();

  if (state.includes('APPROVED') || state.includes('ACCEPTED')) {
    return 'accepted';
  }

  if (state.includes('REJECTED') || state.includes('DENIED') || state.includes('DECLINED') || state.includes('BLOCKED')) {
    return 'rejected';
  }

  return 'reviewing';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}
