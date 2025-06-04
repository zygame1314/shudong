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

export async function onRequestPost({ request, env }) {
  try {
    const correctPassword = env.AUTH_PASSWORD;
    if (!correctPassword) {
      console.error("Error: AUTH_PASSWORD environment variable is not set.");
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), {
        status: 500,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    const providedPassword = requestData?.password;

    if (!providedPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Password is required.' }), {
        status: 400,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }

    if (providedPassword === correctPassword) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid password.' }), {
        status: 401,
        headers: addCorsHeaders({ 'Content-Type': 'application/json' }),
      });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred.' }), {
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