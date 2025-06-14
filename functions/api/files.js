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
  const DB = env.DB;
  if (!DB) {
    console.error("Server config error: D1 binding 'DB' not found.");
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (D1 binding).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  if (action === 'stats') {
    try {
      const stmt = DB.prepare('SELECT COUNT(*) as fileCount, SUM(size) as totalSize FROM files');
      const stats = await stmt.first();
      return new Response(JSON.stringify({
        success: true,
        stats: {
          fileCount: stats.fileCount || 0,
          totalSize: stats.totalSize || 0,
        }
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch (error) {
      console.error('Error fetching file stats from D1:', error);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch file statistics.' }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
  }
  const prefix = url.searchParams.get('prefix') || '';
  const searchTerm = url.searchParams.get('search');
  try {
    let files = [];
    let directories = [];
    let isGlobalSearch = false;
    if (searchTerm) {
      isGlobalSearch = true;
      console.log(`Performing global search for: "${searchTerm}"`);
      const stmt = DB.prepare('SELECT key, name, size, uploaded FROM files WHERE name LIKE ?');
      const { results } = await stmt.bind(`%${searchTerm}%`).all();
      files = results.map(row => ({ ...row, isSearchResult: true }));
    } else {
      console.log(`Listing files for prefix: "${prefix}"`);
      const stmt = DB.prepare('SELECT key, name, size, uploaded FROM files WHERE key LIKE ?');
      const { results } = await stmt.bind(`${prefix}%`).all();
      const directorySet = new Set();
      const prefixLength = prefix.length;
      files = results
        .map(row => {
          const path = row.key.substring(prefixLength);
          const parts = path.split('/');
          if (parts.length > 1) {
            const dirName = parts[0];
            directorySet.add(dirName);
            return null;
          }
          return {
            key: row.key,
            name: path,
            size: row.size,
            uploaded: row.uploaded,
          };
        })
        .filter(Boolean);
      directories = Array.from(directorySet).map(dirName => ({
        key: `${prefix}${dirName}/`,
        name: dirName,
      }));
    }
    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return new Response(JSON.stringify({
      success: true,
      prefix: isGlobalSearch ? '' : prefix,
      files: files,
      directories: directories,
      isGlobalSearch: isGlobalSearch
    }), {
      status: 200,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    const errorContext = searchTerm ? `global search for "${searchTerm}"` : `prefix "${prefix}"`;
    console.error(`Error listing files from D1 during ${errorContext}:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to list files.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-T ype': 'application/json' }),
    });
  }
}
export async function onRequestDelete({ request, env }) {
  if (!verifyPassword(request, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const { key, keys, adminPassword } = payload;
  if ((!key && !keys) || !adminPassword) {
    return new Response(JSON.stringify({ success: false, error: 'Missing key(s) or admin password' }), {
      status: 400,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const correctAdminPassword = env.ADMIN_PASSWORD;
  if (!correctAdminPassword) {
    console.error("Server config error: ADMIN_PASSWORD not set.");
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (Admin).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  if (adminPassword !== correctAdminPassword) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid admin password' }), {
      status: 403,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  const R2_BUCKET = env.R2_bucket;
  const DB = env.DB;
  if (!R2_BUCKET || !DB) {
    console.error("Server config error: R2 or D1 binding not found.");
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 or D1 binding).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  try {
    const itemsToDelete = keys || [key];
    if (itemsToDelete.length === 0) {
      return new Response(JSON.stringify({ success: true, deletedCount: 0, message: 'No items to delete.' }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    const r2KeysToDelete = new Set();
    const dbKeysToDelete = new Set();
    for (const itemKey of itemsToDelete) {
      const isDirectory = itemKey.endsWith('/');
      if (isDirectory) {
        const stmt = DB.prepare('SELECT key FROM files WHERE key LIKE ?');
        const { results } = await stmt.bind(`${itemKey}%`).all();
        if (results) {
          results.forEach(row => {
            r2KeysToDelete.add(row.key);
            dbKeysToDelete.add(row.key);
          });
        }
      } else {
        r2KeysToDelete.add(itemKey);
        dbKeysToDelete.add(itemKey);
      }
    }
    const finalR2Keys = Array.from(r2KeysToDelete);
    const finalDbKeys = Array.from(dbKeysToDelete);
    if (finalR2Keys.length > 0) {
      await R2_BUCKET.delete(finalR2Keys);
      console.log(`Successfully requested deletion of ${finalR2Keys.length} keys from R2.`);
    }
    if (finalDbKeys.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < finalDbKeys.length; i += batchSize) {
        const batch = finalDbKeys.slice(i, i + batchSize);
        const stmt = DB.prepare(`DELETE FROM files WHERE key IN (${batch.map(() => '?').join(',')})`);
        await stmt.bind(...batch).run();
      }
      console.log(`Successfully deleted ${finalDbKeys.length} keys from D1.`);
    }
    return new Response(JSON.stringify({ success: true, deletedCount: finalDbKeys.length }), {
      status: 200,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error(`Error deleting from R2:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to delete file(s).' }), {
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
  if (context.request.method === 'DELETE') {
    return onRequestDelete(context);
  }
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: addCorsHeaders({ 'Content-Type': 'application/json', 'Allow': 'GET, DELETE, OPTIONS' }),
  });
}