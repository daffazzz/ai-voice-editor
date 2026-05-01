const ROBLOX_ASSET_PERMISSIONS_URL = 'https://apis.roblox.com/asset-permissions-api/v1/assets/permissions';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-roblox-api-key'];

  if (!apiKey || Array.isArray(apiKey)) {
    res.status(400).json({ message: 'Missing Roblox API key.' });
    return;
  }

  try {
    const body = await readRequestJson(req);
    const robloxResponse = await fetch(ROBLOX_ASSET_PERMISSIONS_URL, {
      method: 'PATCH',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await robloxResponse.text();
    res.status(robloxResponse.status);
    res.setHeader('content-type', robloxResponse.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Roblox asset permission proxy failed.' });
  }
}

function readRequestJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}
