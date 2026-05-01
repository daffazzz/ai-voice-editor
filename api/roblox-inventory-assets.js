const ROBLOX_AUDIO_ASSET_TYPE_ID = 3;
const ROBLOX_INVENTORY_URL = 'https://inventory.roblox.com/v2/users';
const ROBLOX_ASSET_URL = 'https://apis.roblox.com/assets/v1/assets';
const MAX_ASSET_DETAILS = 100;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-roblox-api-key'];
  const userId = String(req.query.userId || '').trim();

  if (!apiKey || Array.isArray(apiKey)) {
    res.status(400).json({ message: 'Missing Roblox API key.' });
    return;
  }

  if (!/^\d+$/.test(userId)) {
    res.status(400).json({ message: 'Missing or invalid Roblox user ID.' });
    return;
  }

  try {
    const inventoryAssets = await readAudioInventory(userId);
    const assets = await Promise.all(
      inventoryAssets.slice(0, MAX_ASSET_DETAILS).map(asset => enrichAssetWithOpenCloud(apiKey, asset))
    );

    res.status(200).json({ assets });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Roblox inventory asset lookup failed.' });
  }
}

async function readAudioInventory(userId) {
  const assets = [];
  let cursor = '';

  do {
    const url = new URL(`${ROBLOX_INVENTORY_URL}/${encodeURIComponent(userId)}/inventory/${ROBLOX_AUDIO_ASSET_TYPE_ID}`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortOrder', 'Desc');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.errors?.[0]?.message || data?.message || `Roblox inventory lookup failed: ${response.status}`);
    }

    for (const item of data.data || []) {
      const assetId = String(item.assetId || item.id || item.asset?.id || '');
      if (!assetId) continue;

      assets.push({
        id: assetId,
        title: item.name || item.assetName || item.asset?.name || `Audio ${assetId}`,
        status: 'reviewing',
      });
    }

    cursor = data.nextPageCursor || '';
  } while (cursor && assets.length < MAX_ASSET_DETAILS);

  return assets;
}

async function enrichAssetWithOpenCloud(apiKey, asset) {
  try {
    const response = await fetch(`${ROBLOX_ASSET_URL}/${encodeURIComponent(asset.id)}`, {
      headers: {
        'x-api-key': apiKey,
      },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) return asset;

    const moderationState = data.moderationResult?.moderationState || data.moderationState;
    return {
      id: String(data.assetId || asset.id),
      title: data.displayName || asset.title,
      status: getModerationStatus(moderationState),
      moderationState,
    };
  } catch {
    return asset;
  }
}

function getModerationStatus(moderationState = '') {
  const state = moderationState.toUpperCase();

  if (state.includes('APPROVED') || state.includes('ACCEPTED')) return 'accepted';
  if (state.includes('REJECTED') || state.includes('DENIED') || state.includes('DECLINED') || state.includes('BLOCKED')) return 'rejected';
  return 'reviewing';
}
