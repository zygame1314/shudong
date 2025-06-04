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

export async function onRequestGet({ request, env, params }) {
  const filename = decodeURIComponent(params.filename);
  if (!filename) {
      return new Response(JSON.stringify({ success: false, error: 'Filename missing in URL path.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
      });
  }

  if (!verifyPassword(request, env)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const R2_BUCKET = env.R2_bucket;
   if (!R2_BUCKET) {
      console.error("Server config error: R2 binding 'R2_bucket' not found.");
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 binding).' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
   }

  try {
    const object = await R2_BUCKET.get(filename);

    if (object === null) {
      return new Response(JSON.stringify({ success: false, error: 'File not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    const encodedFilename = encodeURIComponent(filename);
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}; filename="${filename}"`);
    headers.set('Content-Length', object.size.toString());

    return new Response(object.body, {
      headers: headers,
      status: 200,
    });

  } catch (error) {
    console.error(`Error fetching file ${filename} from R2:`, error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to retrieve file.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequest(context) {
   if (context.request.method !== 'GET') {
     return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
       status: 405,
       headers: { 'Content-Type': 'application/json', 'Allow': 'GET' },
     });
   }
   return onRequestGet(context);
}