const ROBLOX_OPERATION_URL = 'https://apis.roblox.com/assets/v1/operations';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const apiKey = req.headers['x-roblox-api-key'];
  const operationId = String(req.query.operationId || '');

  if (!apiKey || Array.isArray(apiKey)) {
    res.status(400).json({ message: 'Missing Roblox API key.' });
    return;
  }

  if (!operationId) {
    res.status(400).json({ message: 'Missing Roblox operation id.' });
    return;
  }

  try {
    const robloxResponse = await fetch(`${ROBLOX_OPERATION_URL}/${encodeURIComponent(operationId)}`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    const text = await robloxResponse.text();
    res.status(robloxResponse.status);
    res.setHeader('content-type', robloxResponse.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (error) {
    console.error('Roblox operation proxy failed:', error);
    res.status(502).json({
      message: error.message || 'Roblox proxy operation check failed.',
      operationId,
    });
  }
}
