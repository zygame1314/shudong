import JSZip from 'jszip';
const addCorsHeaders = (headers = {}) => {
  const allowedOrigin = '*';
  return {
    ...headers,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
};
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
  const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024;
  let currentTotalSize = 0;
  const allFileKeysToProcess = new Set();
  for (const key of keys) {
      const isDirectory = key.endsWith('/');
      if (isDirectory) {
          const filesInDirStmt = DB.prepare('SELECT key, size FROM files WHERE key LIKE ? AND is_directory = FALSE');
          const { results: filesInDir } = await filesInDirStmt.bind(`${key}%`).all();
          if (filesInDir) {
              for (const file of filesInDir) {
                  currentTotalSize += (file.size || 0);
                  allFileKeysToProcess.add(file.key);
              }
          }
      } else {
          const fileStmt = DB.prepare('SELECT size FROM files WHERE key = ? AND is_directory = FALSE');
          const fileMeta = await fileStmt.bind(key).first();
          currentTotalSize += (fileMeta?.size || 0);
          allFileKeysToProcess.add(key);
      }
      if (currentTotalSize > MAX_TOTAL_SIZE_BYTES) {
          return new Response(JSON.stringify({ 
              success: false, 
              error: `批量下载的总文件大小超过限制 (${MAX_TOTAL_SIZE_BYTES / (1024 * 1024)}MB)。请减少选择的项目或分批下载。` 
          }), {
              status: 413,
              headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
          });
      }
  }
  if (allFileKeysToProcess.size === 0 && keys.length > 0) { 
       return new Response(JSON.stringify({ success: false, error: '选择的项目中没有可下载的文件。' }), {
          status: 404, 
          headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
  }
  try {
    const zip = new JSZip();
    for (const fileKey of allFileKeysToProcess) {
      const object = await R2_BUCKET.get(fileKey);
      if (object !== null) {
        const buffer = await object.arrayBuffer();
        zip.file(fileKey, buffer); 
      } else {
        console.warn(`File not found in R2: ${fileKey}`);
      }
    }
    if (Object.keys(zip.files).length === 0) {
        return new Response(JSON.stringify({ success: false, error: '没有有效的文件可供下载。' }), {
            status: 404,
            headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
        });
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const headers = addCorsHeaders({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="shudong_download_${Date.now()}.zip"`,
    });
    return new Response(zipBlob, { headers });
  } catch (error) {
    console.error('Error creating zip file:', error);
    return new Response(JSON.stringify({ success: false, error: '创建 ZIP 文件失败。请稍后重试或联系管理员。' }), {
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