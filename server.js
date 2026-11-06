import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Garmin Connect Personal API Proxy
app.use('/api/garmin', async (req, res) => {
  const targetPath = req.url;
  const targetUrl = `https://personal.connectapi.garmin.com${targetPath}`;

  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.referer;
    delete headers.origin;

    const options = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      options.body = Buffer.concat(chunks);
    }

    const apiRes = await fetch(targetUrl, options);
    res.status(apiRes.status);
    apiRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const buffer = await apiRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Garmin Personal API Proxy Error:', err);
    res.status(502).json({ error: 'Failed to communicate with Garmin Personal API' });
  }
});

// Serve Vite build output files
app.use(express.static(path.join(__dirname, 'dist')));

// SPA client-side routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`StridePulse server is running on port ${port}`);
});
