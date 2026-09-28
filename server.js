// server.js
// Render Web Service version of the Render-API relay.
// Deploy this as a Node web service on Render itself instead of Cloudflare.
//
// Environment variables to set in the Render dashboard (your service's
// "Environment" tab):
//   RENDER_API_KEY  = your real Render API key (starts with rnd_...)
//   RELAY_SECRET    = a long random string YOU invent (this is what the
//                     browser sends instead of the real key)
//   ALLOWED_ORIGIN  = (optional) your app's exact URL, e.g.
//                     https://yourname.github.io — defaults to "*"
//
// Render sets PORT automatically; this just listens on it.
// Requires Node 18+ (for the built-in global fetch). No npm packages needed.

const http = require('http');

const PORT = process.env.PORT || 3000;
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RELAY_SECRET = process.env.RELAY_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Secret',
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const providedSecret = req.headers['x-relay-secret'];
  if (!RELAY_SECRET || providedSecret !== RELAY_SECRET) {
    res.writeHead(401, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Unauthorized' }));
    return;
  }

  if (!RENDER_API_KEY) {
    res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Server misconfigured: RENDER_API_KEY is not set' }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      // Whatever path/query the browser calls on this service gets
      // forwarded as-is to Render's API, e.g.
      //   GET /services?limit=50  ->  GET https://api.render.com/v1/services?limit=50
      const targetUrl = 'https://api.render.com/v1' + req.url;

      const init = {
        method: req.method,
        headers: {
          'Authorization': 'Bearer ' + RENDER_API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      };
      if (req.method !== 'GET' && req.method !== 'HEAD' && body) {
        init.body = body;
      }

      const renderRes = await fetch(targetUrl, init);
      const text = await renderRes.text();
      res.writeHead(renderRes.status, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(text);
    } catch (err) {
      res.writeHead(502, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Relay fetch failed: ' + err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log('Render relay listening on port ' + PORT);
});
