function verifyPasswordFromFormData(password, env) {
  const correctPassword = env.AUTH_PASSWORD;
  if (!correctPassword) {
    console.error("Server config error: AUTH_PASSWORD not set.");
    return false;
  }
  return password === correctPassword;
}

export async function onRequestPost({ request, env }) {
  try {
    const R2_BUCKET = env.R2_bucket;
    if (!R2_BUCKET) {
       console.error("Server config error: R2 binding 'R2_bucket' not found.");
       return new Response(JSON.stringify({ success: false, error: 'Server configuration error (R2 binding).' }), {
         status: 500,
         headers: { 'Content-Type': 'application/json' },
       });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request body. Expected FormData.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const file = formData.get('file');
    const password = formData.get('password');
    const filename = file?.name;

    if (!file || !(file instanceof File)) {
       return new Response(JSON.stringify({ success: false, error: 'File data is missing or invalid in FormData.' }), {
         status: 400,
         headers: { 'Content-Type': 'application/json' },
       });
    }
     if (!filename) {
        return new Response(JSON.stringify({ success: false, error: 'Filename could not be determined.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
     }
    if (!password) {
      return new Response(JSON.stringify({ success: false, error: 'Password is required in FormData.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!verifyPasswordFromFormData(password, env)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid password.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
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
      return new Response(JSON.stringify({ success: true, filename: filename }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    } catch (r2Error) {
      console.error(`Error uploading ${filename} to R2:`, r2Error);
      return new Response(JSON.stringify({ success: false, error: `Failed to upload file to storage. ${r2Error.message}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error("Upload processing error:", error);
    return new Response(JSON.stringify({ success: false, error: 'An unexpected error occurred during upload.' }), {
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