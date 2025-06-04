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
    const listed = await R2_BUCKET.list();

    const files = listed.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
    }));


    return new Response(JSON.stringify({ success: true, files: files }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error listing R2 files:", error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to list files.' }), {
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