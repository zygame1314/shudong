const addCorsHeaders = (headers = {}) => {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};
function verifyPassword(request, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) {
    return false;
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const providedPassword = authHeader.substring(7);
  return providedPassword === correctPassword;
}
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: addCorsHeaders(),
    });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method Not Allowed' }), {
      status: 405,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  if (!verifyPassword(request, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const R2_BUCKET = env.R2_bucket;
  if (!R2_BUCKET) {
    console.error("Server config error: R2 binding 'R2_bucket' not found.");
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const isOfficePreview = url.searchParams.get('office') === 'true';
  const previewType = url.searchParams.get('type');
  if (!key) {
    return new Response(JSON.stringify({
      success: false,
      error: 'File key is required.'
    }), {
      status: 400,
      headers: addCorsHeaders({
        'Content-Type': 'application/json'
      }),
    });
  }
  try {
    const object = await R2_BUCKET.get(key);
    if (object === null) {
      return new Response(JSON.stringify({ success: false, error: 'File not found.' }), {
        status: 404,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    if (previewType === 'text') {
      const textContent = await object.text();
      return new Response(JSON.stringify({
        success: true,
        content: textContent
      }), {
        status: 200,
        headers: addCorsHeaders({
          'Content-Type': 'application/json'
        }),
      });
    }
    const expires = Date.now() + 300 * 1000;
    const tokenPayload = `${key}:${expires}`;
    const secret = env.PREVIEW_SECRET || 'default-secret';
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureData = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(tokenPayload));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    let previewUrl;
    if (isOfficePreview) {
      previewUrl = `${new URL(request.url).origin}/api/download/${signature}/${expires}/${encodeURIComponent(key)}`;
    } else {
      previewUrl = `${new URL(request.url).origin}/api/download/${encodeURIComponent(key)}?token=${signature}&expires=${expires}`;
    }
    return new Response(JSON.stringify({ success: true, url: previewUrl }), {
      status: 200,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error(`Error generating preview URL for key "${key}":`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to generate preview URL.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}