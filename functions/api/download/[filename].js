import { jwtVerify } from 'https://esm.sh/jose@5.6.3';

const addCorsHeaders = (headers = {}) => {
  const allowedOrigin = '*';
  const plainHeaders = headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers;
  return {
    ...plainHeaders,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'Content-Disposition, Content-Length',
  };
};

async function verifyAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authorized: false, error: '缺少认证信息' };
    }
    const token = authHeader.substring(7);
    try {
        const secret = new TextEncoder().encode(env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return { authorized: true, user: payload };
    } catch (e) {
        return { authorized: false, error: '认证令牌无效或已过期' };
    }
}

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return new Response(JSON.stringify({ success: false, error: 'File key missing in query string.' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  
  const authResult = await verifyAuth(request, env);
  if (!authResult.authorized) {
      return new Response(JSON.stringify({ success: false, error: authResult.error }), {
          status: 401,
          headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
  }

  const R2_BUCKET = env.R2_bucket;
  if (!R2_BUCKET) {
    console.error("Server config error: R2 binding 'R2_bucket' not found.");
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 binding).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  try {
    console.log(`User ${authResult.user.name} (${authResult.user.account}) is downloading "${key}"`);
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
    baseHeaders.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}; filename="${filename}"`);
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
    return new Response(null, {
      status: 204,
      headers: addCorsHeaders(),
    });
  }

  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }

  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: addCorsHeaders({ 'Content-Type': 'application/json', 'Allow': 'GET, OPTIONS' }),
  });
}