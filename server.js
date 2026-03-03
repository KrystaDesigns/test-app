const http = require('http');
const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_PATH = path.join(ROOT, 'data', 'items.json');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const normalizeKey = (value = '') => value.toLowerCase().replace(/[^a-z]/g, '');

const parseCsv = (csvText) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((header) => normalizeKey(header));
  const nameIndex = headers.findIndex((h) => ['name', 'itemname', 'product'].includes(h));
  const priceIndex = headers.findIndex((h) => ['price', 'unitprice', 'cost'].includes(h));
  const categoryIndex = headers.findIndex((h) => ['category', 'department'].includes(h));
  const barcodeIndex = headers.findIndex((h) => ['barcode', 'sku', 'code'].includes(h));

  if (nameIndex === -1 || priceIndex === -1) {
    throw new Error('CSV requires at least name and price columns.');
  }

  return lines.slice(1)
    .map((line) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, '')))
    .map((cells) => {
      const name = cells[nameIndex];
      const price = Number.parseFloat(cells[priceIndex]);
      if (!name || Number.isNaN(price)) return null;
      return {
        id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        price,
        category: categoryIndex > -1 ? (cells[categoryIndex] || 'General') : 'General',
        barcode: barcodeIndex > -1 ? (cells[barcodeIndex] || '') : '',
      };
    })
    .filter(Boolean);
};

const readItems = async () => JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
const writeItems = async (items) => fs.writeFile(DATA_PATH, JSON.stringify(items, null, 2));

const sendJson = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e7) {
      reject(new Error('Request body too large'));
      req.destroy();
    }
  });
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch {
      reject(new Error('Invalid JSON body'));
    }
  });
  req.on('error', reject);
});

const serveStatic = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fssync.existsSync(fullPath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const data = await fs.readFile(fullPath);

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(data);
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/api/items') {
      return sendJson(res, 200, await readItems());
    }

    if (req.method === 'POST' && url.pathname === '/api/items/manual') {
      const body = await readJsonBody(req);
      const { name, price, category = 'General', barcode = '' } = body;

      if (!name || Number.isNaN(Number(price))) {
        return sendJson(res, 400, { error: 'name and valid price are required' });
      }

      const items = await readItems();
      const item = {
        id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: String(name).trim(),
        price: Number(price),
        category: String(category || 'General').trim() || 'General',
        barcode: String(barcode || '').trim(),
      };

      items.push(item);
      await writeItems(items);
      return sendJson(res, 201, item);
    }

    if (req.method === 'POST' && url.pathname === '/api/items/csv') {
      const body = await readJsonBody(req);
      const csv = body.csv;
      if (!csv || typeof csv !== 'string') {
        return sendJson(res, 400, { error: 'csv text is required' });
      }

      const parsed = parseCsv(csv);
      if (!parsed.length) {
        return sendJson(res, 400, { error: 'No valid rows found in CSV' });
      }

      const items = await readItems();
      await writeItems(items.concat(parsed));
      return sendJson(res, 201, { added: parsed.length });
    }

    if (req.method === 'POST' && url.pathname === '/api/items/sheets') {
      const body = await readJsonBody(req);
      const syncUrl = body.url;
      if (!syncUrl || typeof syncUrl !== 'string') {
        return sendJson(res, 400, { error: 'Google Sheets URL is required' });
      }

      const response = await fetch(syncUrl);
      if (!response.ok) {
        return sendJson(res, 400, { error: `Failed to fetch sheet: ${response.status}` });
      }

      const csvText = await response.text();
      const parsed = parseCsv(csvText);
      if (!parsed.length) {
        return sendJson(res, 400, { error: 'No valid rows found in sheet CSV' });
      }

      const items = await readItems();
      await writeItems(items.concat(parsed));
      return sendJson(res, 201, { added: parsed.length });
    }

    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Not found' });
    }

    return await serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Unexpected server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Supermarket POS server running at http://localhost:${PORT}`);
});
