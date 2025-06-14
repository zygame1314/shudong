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

  if (!key) {
    return new Response(JSON.stringify({ success: false, error: 'File key is required.' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  try {
    // We don't need the object body, just the signed URL.
    // The `get` method without reading the body is efficient.
    const object = await R2_BUCKET.get(key);

    if (object === null) {
      return new Response(JSON.stringify({ success: false, error: 'File not found.' }), {
        status: 404,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    
    // This is a pseudo-implementation. Cloudflare Workers Pages Functions
    // do not directly support creating signed URLs via an SDK method like `getSignedUrl`.
    // The actual implementation requires a separate worker or a different approach.
    // For this context, we assume a custom domain is set up for the R2 bucket,
    // and we can construct a URL that will be publicly accessible.
    // A real implementation would involve a worker that fetches from R2 and serves the file.
    // Let's assume the download worker can handle this if we pass a temporary token.
    //
    // A better approach for actual Cloudflare Workers is to use a custom domain for R2
    // and make it public, or create a worker that streams the file.
    // Since we have a download worker, let's generate a temporary access token.
    // This is a conceptual workaround as there's no direct `sign` method here.
    // The most secure way is a worker that validates a short-lived token and then serves the file.
    
    // Let's adjust the plan: The preview URL will point to the download worker,
    // but with a short-lived token in the query string. The download worker needs to be updated
    // to accept this token. This is more secure than creating a public URL.

    // Given the constraints, let's stick to the original idea of a new endpoint,
    // but acknowledge the signing limitation. We will return a direct-like URL,
    // assuming the download worker can be modified.
    // For now, let's just return the download URL and modify the frontend to call this endpoint first.
    
    // The user's problem is that the Office viewer cannot authenticate.
    // The best solution is a temporary, public URL.
    // Cloudflare R2 supports public buckets via a custom domain. If not public,
    // we need a worker to proxy the download. The existing download worker is almost that,
    // it just needs to bypass auth for specific, temporary requests.
    
    // Let's create a "signed" URL concept manually.
    // This is not a real cryptographic signature but a time-limited token.
    const expires = Date.now() + 300 * 1000; // 5 minutes
    const tokenPayload = `${key}:${expires}`;
    // In a real app, use a secret key from env to create a HMAC signature.
    const secret = env.PREVIEW_SECRET || 'default-secret';
    // Node.js crypto is not available, but Web Crypto API is.
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureData = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(tokenPayload));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const previewUrl = `${new URL(request.url).origin}/api/download/${encodeURIComponent(key)}?token=${signature}&expires=${expires}`;

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