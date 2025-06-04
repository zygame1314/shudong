const addCorsHeaders = (headers = {}) => {
  const allowedOrigin = '*';
  return {
    ...headers,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
};

function verifyPassword(request, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) {
    console.error("Server config error: AUTH_PASSWORD not set.");
    return false;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const providedPassword = authHeader.substring(7);
  return providedPassword === correctPassword;
}

export async function onRequestGet({ request, env }) {
  if (!verifyPassword(request, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
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

  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';

  try {
    const listOptions = {
        prefix: prefix,
        delimiter: '/',
    };

    const listed = await R2_BUCKET.list(listOptions);

    const files = listed.objects
        .filter(obj => obj.key !== prefix && !obj.key.endsWith('/'))
        .map(obj => ({
            key: obj.key,
            name: obj.key.substring(prefix.length),
            size: obj.size,
            uploaded: obj.uploaded,
        }));

    const directories = listed.delimitedPrefixes.map(dirPrefix => ({
        key: dirPrefix,
        name: dirPrefix.substring(prefix.length).replace(/\/$/, ''),
    }));


    return new Response(JSON.stringify({
        success: true,
        prefix: prefix,
        files: files,
        directories: directories
    }), {
      status: 200,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });

  } catch (error) {
    console.error(`Error listing R2 files with prefix "${prefix}":`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to list files.' }), {
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