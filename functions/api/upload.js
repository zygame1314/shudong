import { jwtVerify } from 'jose';

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

export async function onRequestPost({ request, env }) {
  try {
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
    const path = formData.get('path') || '';
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
    
    const objectKey = path ? `${path}/${filename}` : filename;

    try {
      console.log(`User ${authResult.user.name} (${authResult.user.account}) is uploading "${filename}" to "${objectKey}"`);
      const uploadedObject = await R2_BUCKET.put(objectKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });

      if (!uploadedObject) {
        console.warn(`R2 put for ${filename} returned:`, uploadedObject);
      }

      console.log(`Successfully uploaded ${filename} to R2 as ${objectKey}.`);
      return new Response(JSON.stringify({ success: true, filename: objectKey }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });

    } catch (r2Error) {
      console.error(`Error uploading ${objectKey} to R2:`, r2Error);
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