const ROBLOX_CREATE_ASSET_URL = 'https://apis.roblox.com/assets/v1/assets';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-roblox-api-key'];
  const contentType = req.headers['content-type'];

  if (!apiKey || Array.isArray(apiKey)) {
    res.status(400).json({ message: 'Missing Roblox API key.' });
    return;
  }

  if (!contentType?.includes('multipart/form-data')) {
    res.status(400).json({ message: 'Expected multipart/form-data.' });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const robloxResponse = await fetch(ROBLOX_CREATE_ASSET_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': contentType,
      },
      body,
    });

    const text = await robloxResponse.text();
    res.status(robloxResponse.status);
    res.setHeader('content-type', robloxResponse.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Roblox proxy upload failed.' });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
