const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// Import function handlers
const generateAnalysis = require('./netlify/functions/generate-analysis');
const publishAnalysis = require('./netlify/functions/publish-analysis');
const getMatches = require('./netlify/functions/get-matches');
const getAnalysis = require('./netlify/functions/get-analysis');
const addUser = require('./netlify/functions/add-user');

function netlifyToExpress(handler, req, body, queryParams) {
  return handler.handler({
    httpMethod: req.method,
    body: body,
    queryStringParameters: queryParams
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query = parsed.query;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API routes
  if (pathname.startsWith('/.netlify/functions/') || pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let result;
        const funcName = pathname.replace('/.netlify/functions/', '').replace('/api/', '');

        if (funcName === 'generate-analysis') result = await netlifyToExpress(generateAnalysis, req, body, query);
        else if (funcName === 'publish-analysis') result = await netlifyToExpress(publishAnalysis, req, body, query);
        else if (funcName === 'get-matches') result = await netlifyToExpress(getMatches, req, body, query);
        else if (funcName === 'get-analysis') result = await netlifyToExpress(getAnalysis, req, body, query);
        else if (funcName === 'add-user') result = await netlifyToExpress(addUser, req, body, query);
        else { res.writeHead(404); res.end('Not found'); return; }

        res.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
        res.end(result.body);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA
      fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Taktix running on port ${PORT}`));
