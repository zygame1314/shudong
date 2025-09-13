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
const DEFAULT_PAGE_SIZE = 20;
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
  if (action === 'listAllDirs') {
    try {
      const stmt = DB.prepare("SELECT key FROM files WHERE is_directory = TRUE ORDER BY key ASC");
      const { results } = await stmt.all();
      const directories = results.map(row => row.key);
      return new Response(JSON.stringify({ success: true, directories: directories }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch (error) {
      console.error('Error fetching all directories from D1:', error);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch directory list.' }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
  }
  if (action === 'getHotFolders') {
    try {
      const stmt = DB.prepare(`
        SELECT
          parent_path,
          SUM(downloads) as total_downloads
        FROM files
        WHERE parent_path != '' AND is_directory = FALSE
        GROUP BY parent_path
        ORDER BY total_downloads DESC
        LIMIT 5
      `);
      const { results } = await stmt.all();
      const hotFolders = results.map(row => ({
        path: row.parent_path,
        name: row.parent_path.endsWith('/') ? row.parent_path.slice(0, -1).split('/').pop() : row.parent_path.split('/').pop(),
        total_downloads: row.total_downloads
      }));
      return new Response(JSON.stringify({ success: true, hotFolders: hotFolders }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch (error) {
      console.error('Error fetching hot folders from D1:', error);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch hot folders.' }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
  }
  const prefix = url.searchParams.get('prefix') || '';
  const searchTerm = url.searchParams.get('search');
  const page = parseInt(url.searchParams.get('page')) || 1;
  const limit = parseInt(url.searchParams.get('limit')) || DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * limit;
  try {
    if (searchTerm) {
      console.log(`Performing global search for: "${searchTerm}", page: ${page}, limit: ${limit}`);
      const searchCondition = `%${searchTerm}%`;
      const countStmt = DB.prepare('SELECT COUNT(*) as total FROM files WHERE name LIKE ?');
      const { total: totalItems } = await countStmt.bind(searchCondition).first();
      const totalPages = Math.ceil(totalItems / limit);
      const searchStmt = DB.prepare('SELECT key, name, size, uploaded, is_directory, parent_path, downloads FROM files WHERE name LIKE ? ORDER BY is_directory DESC, name ASC LIMIT ? OFFSET ?');
      const { results: filesResults } = await searchStmt.bind(searchCondition, limit, offset).all();
      const responseItems = filesResults.map(f => ({
        key: f.key,
        name: f.name,
        size: f.size,
        uploaded: f.uploaded,
        isDirectory: !!f.is_directory,
        parent_path: f.parent_path,
        downloads: f.downloads || 0,
        isSearchResult: true
      }));
      return new Response(JSON.stringify({
        success: true,
        files: responseItems,
        directories: [],
        isGlobalSearch: true,
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limit
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    } else {
      console.log(`Listing files for prefix: "${prefix}", page: ${page}, limit: ${limit}`);
      const filesStmt = DB.prepare(
        'SELECT key, name, size, uploaded, contentType, is_directory, downloads FROM files WHERE parent_path = ? AND is_directory = FALSE ORDER BY name ASC'
      );
      const { results: filesFromDb } = await filesStmt.bind(prefix).all();
      const fileList = filesFromDb.map(f => ({
        key: f.key,
        name: f.name,
        size: f.size,
        uploaded: f.uploaded,
        contentType: f.contentType,
        isDirectory: f.is_directory,
        downloads: f.downloads || 0
      }));
      const dirsStmt = DB.prepare(
        'SELECT key, name, size, uploaded, contentType, is_directory FROM files WHERE parent_path = ? AND is_directory = TRUE ORDER BY name ASC'
      );
      const { results: dirsFromDb } = await dirsStmt.bind(prefix).all();
      const sortedDirectories = dirsFromDb.map(d => ({
        key: d.key,
        name: d.name,
        isDirectory: d.is_directory
      }));
      const sortedFiles = fileList.sort((a, b) => a.name.localeCompare(b.name));
      const combinedItems = [...sortedDirectories, ...sortedFiles];
      const totalItems = combinedItems.length;
      const totalPages = Math.ceil(totalItems / limit);
      const paginatedCombinedItems = combinedItems.slice(offset, offset + limit);
      const responseDirectories = paginatedCombinedItems.filter(item => item.isDirectory);
      const responseFiles = paginatedCombinedItems.filter(item => !item.isDirectory);
      return new Response(JSON.stringify({
        success: true,
        prefix: prefix,
        files: responseFiles,
        directories: responseDirectories,
        isGlobalSearch: false,
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        limit: limit
      }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
  } catch (error) {
    const errorContext = searchTerm ? `global search for "${searchTerm}"` : `prefix "${prefix}"`;
    console.error(`Error listing files from D1 during ${errorContext}:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to list files.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}
export async function onRequestDelete({ request, env, waitUntil }) {
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
    const deleteOperations = async () => {
      try {
        const r2KeysToDelete = new Set();
        const dbKeysToDelete = new Set();
        for (const itemKey of itemsToDelete) {
          const isDirectory = itemKey.endsWith('/');
          if (isDirectory) {
            r2KeysToDelete.add(itemKey);
            dbKeysToDelete.add(itemKey);
            const batchSize = 1000;
            let offset = 0;
            while (true) {
              const stmt = DB.prepare('SELECT key FROM files WHERE key LIKE ? LIMIT ? OFFSET ?');
              const { results } = await stmt.bind(`${itemKey}%`, batchSize, offset).all();
              if (results && results.length > 0) {
                results.forEach(row => {
                  r2KeysToDelete.add(row.key);
                  dbKeysToDelete.add(row.key);
                });
                if (results.length < batchSize) {
                  break;
                }
                offset += results.length;
              } else {
                break;
              }
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
      } catch (error) {
        console.error(`Error during background deletion:`, error);
      }
    };
    waitUntil(deleteOperations());
    return new Response(JSON.stringify({ success: true, message: `Deletion of ${itemsToDelete.length} item(s) initiated.` }), {
      status: 202,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error(`Error initiating deletion:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to initiate file deletion.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}
export async function onRequestPut({ request, env }) {
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
  const { key, newName, adminPassword } = payload;
  if (!key || !newName || !adminPassword) {
    return new Response(JSON.stringify({ success: false, error: 'Missing key, newName, or admin password' }), {
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
    const fileStmt = DB.prepare('SELECT * FROM files WHERE key = ?');
    const fileToRename = await fileStmt.bind(key).first();
    if (!fileToRename) {
      return new Response(JSON.stringify({ success: false, error: 'Item not found in database' }), { status: 404, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
    }
    const isDirectory = fileToRename.is_directory;
    const parentPath = fileToRename.parent_path;
    const newKey = `${parentPath}${newName}${isDirectory ? '/' : ''}`;
    if (isDirectory) {
      const listStmt = DB.prepare('SELECT * FROM files WHERE key LIKE ?');
      const { results: itemsToRename } = await listStmt.bind(`${key}%`).all();
      const r2ObjectsToCopy = [];
      const dbUpdates = [];
      for (const item of itemsToRename) {
        const newSubKey = item.key.replace(key, newKey);
        r2ObjectsToCopy.push({ source: item.key, destination: newSubKey });
        const newSubParentPath = item.parent_path.replace(key, newKey);
        const newSubName = newSubKey.endsWith('/') ? newSubKey.slice(0, -1).split('/').pop() : newSubKey.split('/').pop();
        dbUpdates.push(DB.prepare('UPDATE files SET key = ?, name = ?, parent_path = ? WHERE key = ?').bind(newSubKey, newSubName, newSubParentPath, item.key));
      }
      for (const { source, destination } of r2ObjectsToCopy) {
        const head = await R2_BUCKET.head(source);
        if (head) {
          await R2_BUCKET.put(destination, null, {
            copySource: source,
            httpMetadata: head.httpMetadata
          });
        }
      }
      await DB.batch(dbUpdates);
      const keysToDelete = r2ObjectsToCopy.map(o => o.source);
      if (keysToDelete.length > 0) {
        await R2_BUCKET.delete(keysToDelete);
      }
    } else {
      const head = await R2_BUCKET.head(key);
      if (head === null) {
        return new Response(JSON.stringify({ success: false, error: 'File not found in R2' }), { status: 404, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
      }
      await R2_BUCKET.put(newKey, null, {
        copySource: key,
        httpMetadata: head.httpMetadata
      });
      await R2_BUCKET.delete(key);
      const stmt = DB.prepare('UPDATE files SET key = ?, name = ? WHERE key = ?');
      await stmt.bind(newKey, newName, key).run();
    }
    return new Response(JSON.stringify({ success: true, message: `Item renamed to ${newName}` }), {
      status: 200,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error(`Error renaming item:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to rename item.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
}
export async function onRequestPost({ request, env, waitUntil }) {
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
  const { sourceKey, destinationPath, adminPassword } = payload;
  if (!sourceKey || destinationPath === undefined || !adminPassword) {
    return new Response(JSON.stringify({ success: false, error: 'Missing sourceKey, destinationPath, or admin password' }), {
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
    const fileStmt = DB.prepare('SELECT * FROM files WHERE key = ?');
    const itemToMove = await fileStmt.bind(sourceKey).first();
    if (!itemToMove) {
      return new Response(JSON.stringify({ success: false, error: 'Item not found in database' }), { status: 404, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
    }
    const isDirectory = itemToMove.is_directory;
    const itemName = itemToMove.name;
    const newBaseKey = `${destinationPath}${itemName}${isDirectory ? '/' : ''}`;
    if (newBaseKey === sourceKey) {
      return new Response(JSON.stringify({ success: false, error: 'Source and destination are the same.' }), { status: 400, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
    }
    const destCheckStmt = DB.prepare('SELECT key FROM files WHERE key = ?');
    const destExists = await destCheckStmt.bind(newBaseKey).first();
    if (destExists) {
      return new Response(JSON.stringify({ success: false, error: 'An item with the same name already exists in the destination.' }), { status: 409, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
    }
    if (isDirectory) {
      const listStmt = DB.prepare('SELECT * FROM files WHERE key LIKE ?');
      const { results: itemsToMove } = await listStmt.bind(`${sourceKey}%`).all();
      const dbUpdates = [];
      const r2ObjectsToCopy = [];
      for (const item of itemsToMove) {
        const newSubKey = item.key.replace(sourceKey, newBaseKey);
        r2ObjectsToCopy.push({ source: item.key, destination: newSubKey });
        let newParentPath;
        if (item.key === sourceKey) {
          newParentPath = destinationPath;
        } else {
          newParentPath = item.parent_path.replace(sourceKey, newBaseKey);
        }
        dbUpdates.push(DB.prepare('UPDATE files SET key = ?, parent_path = ? WHERE key = ?').bind(newSubKey, newParentPath, item.key));
      }
      for (const { source, destination } of r2ObjectsToCopy) {
        const head = await R2_BUCKET.head(source);
        if (head) {
          await R2_BUCKET.put(destination, null, {
            copySource: source,
            httpMetadata: head.httpMetadata
          });
        }
      }
      await DB.batch(dbUpdates);
      const keysToDelete = r2ObjectsToCopy.map(o => o.source);
      if (keysToDelete.length > 0) {
        waitUntil(R2_BUCKET.delete(keysToDelete));
      }
    } else {
      const head = await R2_BUCKET.head(sourceKey);
      if (head === null) {
        return new Response(JSON.stringify({ success: false, error: 'File not found in R2' }), { status: 404, headers: addCorsHeaders({ 'Content-Type': 'application/json' }) });
      }
      await R2_BUCKET.put(newBaseKey, null, {
        copySource: sourceKey,
        httpMetadata: head.httpMetadata
      });
      await R2_BUCKET.delete(sourceKey);
      const stmt = DB.prepare('UPDATE files SET key = ?, parent_path = ? WHERE key = ?');
      await stmt.bind(newBaseKey, destinationPath, sourceKey).run();
    }
    return new Response(JSON.stringify({ success: true, message: `Item successfully moved to ${destinationPath}` }), {
      status: 200,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch (error) {
    console.error(`Error moving item:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to move item.' }), {
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
  if (context.request.method === 'PUT') {
    return onRequestPut(context);
  }
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: addCorsHeaders({ 'Content-Type': 'application/json', 'Allow': 'GET, POST, DELETE, PUT, OPTIONS' }),
  });
}