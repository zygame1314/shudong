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
function verifyPasswordFromFormData(password, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) {
    console.error("Server config error: AUTH_PASSWORD not set.");
    return false;
  }
  return password === correctPassword;
}
async function ensureDirectoryExists(db, fullPath, env) {
  const pathSegments = fullPath.split('/').filter(segment => segment.length > 0);
  let currentPath = '';
  for (let i = 0; i < pathSegments.length -1; i++) {
    const segment = pathSegments[i];
    const parentPathForCurrentDir = currentPath;
    currentPath += segment + '/';
    try {
      const checkStmt = db.prepare('SELECT key FROM files WHERE key = ? AND is_directory = TRUE');
      const existingDir = await checkStmt.bind(currentPath).first();
      if (!existingDir) {
        const insertDirStmt = db.prepare(
          'INSERT INTO files (key, name, size, uploaded, contentType, parent_path, is_directory, downloads) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        await insertDirStmt.bind(
          currentPath,
          segment,
          0,
          new Date().toISOString(),
          'inode/directory',
          parentPathForCurrentDir,
          true,
          0
        ).run();
        console.log(`Created directory entry in D1: ${currentPath}`);
      }
    } catch (error) {
      console.error(`Error ensuring directory ${currentPath} exists in D1:`, error);
    }
  }
}
export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const R2_BUCKET = env.R2_bucket;
    const DB = env.DB;
    if (!R2_BUCKET || !DB) {
      console.error("Server config error: R2 or D1 binding not found.");
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 or D1 binding).' }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body. Expected FormData.' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    const file = formData.get('file');
    const password = formData.get('password');
    const filename = file?.name;
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ success: false, error: 'File data is missing or invalid in FormData.' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    if (!filename) {
      return new Response(JSON.stringify({ success: false, error: 'Filename could not be determined.' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    if (!password) {
      return new Response(JSON.stringify({ success: false, error: 'Password is required in FormData.' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    if (!verifyPasswordFromFormData(password, env)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid password.' }), {
        status: 401,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    const MAX_FILE_SIZE = 300 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ success: false, error: 'File size exceeds the 300MB limit.' }), {
        status: 413,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
    try {
      const uploadedObject = await R2_BUCKET.put(filename, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      if (!uploadedObject) {
        console.warn(`R2 put for ${filename} returned:`, uploadedObject);
      }
      console.log(`Successfully uploaded ${filename} to R2.`);
      const dbOperations = async () => {
        try {
          await ensureDirectoryExists(DB, filename, env);
          const stmt = DB.prepare(
            'INSERT INTO files (key, name, size, uploaded, contentType, parent_path, is_directory, downloads) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          const parts = filename.split('/');
          const name = parts.pop();
          const parent_path = parts.length > 0 ? parts.join('/') + '/' : '';
          await stmt.bind(filename, name, file.size, new Date().toISOString(), file.type, parent_path, false, 0).run();
          console.log(`Successfully inserted file metadata for ${filename} into D1.`);
        } catch (dbError) {
          console.error(`Error during background database operations for ${filename}:`, dbError);
        }
      };
      waitUntil(dbOperations());
      return new Response(JSON.stringify({ success: true, filename: filename }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    } catch (r2Error) {
      console.error(`Error uploading ${filename} to R2:`, r2Error);
      return new Response(JSON.stringify({ success: false, error: `Failed to upload file to storage. ${r2Error.message}` }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
  } catch (error) {
    console.error("Upload processing error:", error);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred during upload.' }), {
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
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
    status: 405,
    headers: addCorsHeaders({ 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' }),
  });
}