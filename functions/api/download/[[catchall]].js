const addCorsHeaders = (headers = {}) => {
  const allowedOrigin = '*';
  const plainHeaders = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  return {
    ...plainHeaders,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
  };
};
async function verifyToken(key, token, expires, secret) {
  if (!token || !expires) return false;
  if (Date.now() > parseInt(expires, 10)) return false;
  const tokenPayload = `${key}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureData = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(tokenPayload));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return token === expectedSignature;
}
function verifyPassword(request, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) return false;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const providedPassword = authHeader.substring(7);
  return providedPassword === correctPassword;
}
export async function onRequestGet({ request, env, params }) {
  const segments = params.catchall || [];
  let isAuthorized = false;
  let key = '';
  let isTokenAuth = false;
  if (segments.length > 2 && !isNaN(parseInt(segments[0], 10))) {
      const [expires, token, ...fileKeyParts] = segments;
      key = fileKeyParts.join('/');
      const secret = env.PREVIEW_SECRET || 'default-secret';
      isAuthorized = await verifyToken(key, token, expires, secret);
      isTokenAuth = true;
      if (!isAuthorized) {
         return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token.' }), {
          status: 403,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
        });
      }
  } else {
      key = segments.join('/');
      isAuthorized = verifyPassword(request, env);
  }
  if (!key) {
    return new Response(JSON.stringify({ success: false, error: 'Filename missing.' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  if (!isAuthorized) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const R2_BUCKET = env.R2_bucket;
  if (!R2_BUCKET) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
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
    const baseHeaders = new Headers();
    object.writeHttpMetadata(baseHeaders);
    const filename = key.split('/').pop();
    const encodedFilename = encodeURIComponent(filename);
    if (!isTokenAuth) {
        baseHeaders.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}; filename="${filename}"`);
    }
    baseHeaders.set('Content-Length', object.size.toString());
    const finalHeaders = addCorsHeaders(baseHeaders);
    return new Response(object.body, {
      headers: finalHeaders,
      status: 200,
    });
  } catch (error) {
    console.error(`Error fetching file ${key} from R2:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to retrieve file.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: addCorsHeaders() });
  }
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: addCorsHeaders({ 'Content-Type': 'application/json', 'Allow': 'GET, OPTIONS' }),
  });
}