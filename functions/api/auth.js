export async function onRequestPost({ request, env }) {
  try {
    const correctPassword = env.AUTH_PASSWORD;
    if (!correctPassword) {
      console.error("Error: AUTH_PASSWORD environment variable is not set.");
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let requestData;
    try {
      requestData = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const providedPassword = requestData?.password;

    if (!providedPassword) {
      return new Response(JSON.stringify({ success: false, error: 'Password is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (providedPassword === correctPassword) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid password.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequest(context) {
   if (context.request.method !== 'POST') {
     return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
       status: 405,
       headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
     });
   }
   return onRequestPost(context);
}