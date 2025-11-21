const addCorsHeaders = (headers = {}) => {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};
async function verifySignature(signature, key, expires, secret) {
  if (Date.now() > parseInt(expires)) {
    console.log("Token expired");
    return false;
  }
  const tokenPayload = `${key}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureData = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(tokenPayload));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return signature === expectedSignature;
}
function verifyPassword(request, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) return false;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const providedPassword = authHeader.substring(7);
  return providedPassword === correctPassword;
}
export async function onRequest(context) {
  const { request, env, params } = context;
  const path = params.path;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: addCorsHeaders() });
  }
  let key;
  let isAuthorized = false;
  if (path.length >= 3) {
    const [signature, expires, ...keyParts] = path;
    key = decodeURIComponent(keyParts.join('/'));
    const secret = env.PREVIEW_SECRET || 'default-secret';
    isAuthorized = await verifySignature(signature, key, expires, secret);
    if (!isAuthorized) {
        console.error(`Path-based auth failed for key "${key}". Signature: ${signature}, Expires: ${expires}`);
    }
  }
  else if (path.length === 1) {
    key = decodeURIComponent(path[0]);
    if (verifyPassword(request, env)) {
      isAuthorized = true;
    }
    else {
      const url = new URL(request.url);
      const token = url.searchParams.get('token');
      const expires = url.searchParams.get('expires');
      if (token && expires) {
        const secret = env.PREVIEW_SECRET || 'default-secret';
        isAuthorized = await verifySignature(token, key, expires, secret);
        if (!isAuthorized) {
            console.error(`Query-based auth failed for key "${key}". Token: ${token}, Expires: ${expires}`);
        }
      }
    }
  }
  if (!isAuthorized) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  if (!key) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid file path' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  try {
    const object = await env.R2_bucket.get(key);
    if (object === null) {
      return new Response(JSON.stringify({ success: false, error: 'File not found' }), {
        status: 404,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    const filename = key.split('/').pop();
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    const corsHeaders = addCorsHeaders();
    for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value);
    }
    const updateDownloads = async () => {
      try {
        const DB = env.DB;
        if (DB) {
          const stmt = DB.prepare('UPDATE files SET downloads = downloads + 1 WHERE key = ?');
          await stmt.bind(key).run();
          console.log(`Incremented download count for ${key}`);
        }
      } catch (dbError) {
        console.error(`Failed to update download count for ${key}:`, dbError);
      }
    };
    context.waitUntil(updateDownloads());
    return new Response(object.body, { headers });
  } catch (error) {
    console.error(`Error fetching key "${key}" from R2:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch file from storage.' }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}