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
  const searchTerm = url.searchParams.get('search');
  try {
    let files = [];
    let directories = [];
    let isGlobalSearch = false;
    if (searchTerm) {
      isGlobalSearch = true;
      console.log(`Performing global search for: "${searchTerm}"`);
      const listOptions = {
      };
      let listed;
      let truncated = true;
      let cursor = undefined;
      const allObjects = [];
      while (truncated) {
        listed = await R2_BUCKET.list({ ...listOptions, cursor: cursor });
        allObjects.push(...listed.objects);
        truncated = listed.truncated;
        cursor = listed.truncated ? listed.cursor : undefined;
      }
      console.log(`Found ${allObjects.length} total objects during global search.`);
      const lowerSearchTerm = searchTerm.toLowerCase();
      allObjects.forEach(obj => {
        const parts = obj.key.split('/');
        let namePart = '';
        if (obj.key.endsWith('/')) {
          namePart = parts[parts.length - 2];
        } else {
          namePart = parts[parts.length - 1];
        }
        if (namePart && namePart.toLowerCase().includes(lowerSearchTerm)) {
          files.push({
            key: obj.key,
            name: obj.key,
            size: obj.size,
            uploaded: obj.uploaded,
            isSearchResult: true,
            isDirectoryPlaceholder: obj.key.endsWith('/')
          });
        }
      });
      console.log(`Found ${files.length} matching files/objects for search term "${searchTerm}".`);
    } else {
      console.log(`Listing files for prefix: "${prefix}"`);
      const listOptions = {
        prefix: prefix,
        delimiter: '/',
      };
      const listed = await R2_BUCKET.list(listOptions);
      files = listed.objects
        .filter(obj => obj.key !== prefix && !obj.key.endsWith('/'))
        .map(obj => ({
          key: obj.key,
          name: obj.key.substring(prefix.length),
          size: obj.size,
          uploaded: obj.uploaded,
        }));
      directories = listed.delimitedPrefixes.map(dirPrefix => ({
        key: dirPrefix,
        name: dirPrefix.substring(prefix.length).replace(/\/$/, ''),
      }));
    }
    directories.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => {
      if (isGlobalSearch) {
        const aIsDir = a.isDirectoryPlaceholder;
        const bIsDir = b.isDirectoryPlaceholder;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.key.localeCompare(b.key);
      } else {
        return a.name.localeCompare(b.name);
      }
    });
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
    console.error(`Error listing R2 files during ${errorContext}:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to list files.' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
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
  const { key, adminPassword } = payload;
  if (!key || !adminPassword) {
    return new Response(JSON.stringify({ success: false, error: 'Missing key or admin password' }), {
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
  if (!R2_BUCKET) {
    console.error("Server config error: R2 binding 'R2_bucket' not found.");
    return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 binding).' }), {
      status: 500,
      headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
    });
  }
  try {
    const isDirectory = key.endsWith('/');
    if (isDirectory) {
      const list = await R2_BUCKET.list({ prefix: key });
      const keysToDelete = list.objects.map(obj => obj.key);
      if (keysToDelete.length > 0) {
        await R2_BUCKET.delete(keysToDelete);
      }
    } else {
      await R2_BUCKET.delete(key);
    }
    return new Response(JSON.stringify({ success: true }), {
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