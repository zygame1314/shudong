const addCorsHeaders = (headers = {}) => {
  const allowedOrigin = '*';
  return {
    ...headers,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};
async function generateToken(key, secret, expiration = 3600) {
  const expires = Date.now() + expiration * 1000;
  const tokenPayload = `${key}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureData = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(tokenPayload));
  const token = btoa(String.fromCharCode(...new Uint8Array(signatureData))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { token, expires };
}
function verifyPassword(request, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) return false;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  return authHeader.substring(7) === correctPassword;
}
export async function onRequestPost({ request, env }) {
  if (!verifyPassword(request, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const R2_BUCKET = env.R2_bucket;
  if (!R2_BUCKET) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 binding).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const { keys } = payload;
  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'Missing or invalid keys array.' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const DB = env.DB;
  if (!DB) {
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (D1 binding).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const allFileKeysToProcess = new Set();
  for (const key of keys) {
      const isDirectory = key.endsWith('/');
      if (isDirectory) {
          const filesInDirStmt = DB.prepare('SELECT key FROM files WHERE key LIKE ? AND is_directory = FALSE');
          const { results: filesInDir } = await filesInDirStmt.bind(`${key}%`).all();
          if (filesInDir) {
              for (const file of filesInDir) {
                  allFileKeysToProcess.add(file.key);
              }
          }
      } else {
          allFileKeysToProcess.add(key);
      }
  }
  if (allFileKeysToProcess.size === 0 && keys.length > 0) { 
       return new Response(JSON.stringify({ success: false, error: '选择的项目中没有可下载的文件。' }), {
          status: 404, 
          headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
  }
  try {
    const secret = env.PREVIEW_SECRET || 'default-secret';
    const signedUrls = [];
    for (const fileKey of allFileKeysToProcess) {
      const { token, expires } = await generateToken(fileKey, secret);
      const urlPath = `/api/download/${encodeURIComponent(fileKey)}?token=${token}&expires=${expires}`;
      signedUrls.push({
        key: fileKey,
        filename: fileKey.split('/').pop(),
        urlPath: urlPath
      });
    }
    if (signedUrls.length === 0) {
      return new Response(JSON.stringify({ success: false, error: '没有有效的文件可供下载。' }), {
        status: 404,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    return new Response(JSON.stringify({ success: true, files: signedUrls }), {
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error('Error generating signed URLs:', error);
    return new Response(JSON.stringify({ success: false, error: '生成下载链接失败。请稍后重试或联系管理员。' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}
export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: addCorsHeaders() });
  }
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: addCorsHeaders({ 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' }),
  });
}