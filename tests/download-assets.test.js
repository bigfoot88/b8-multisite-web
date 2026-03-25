const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.join(__dirname, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'download-assets.mjs');

function parsePngSize(buffer) {
  assert.equal(buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function runDownloadAssets(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      resolve({
        status: code,
        signal,
        stdout,
        stderr,
      });
    });
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address()));
  });
}

test('download-assets rejects mismatched payloads and preserves curated local files', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-download-assets-'));
  const uploadRoot = path.join(tempDir, 'uploads');
  const seedPath = path.join(tempDir, 'seed.json');
  const relativePath = path.join('seeds', 'dma', 'dma-lite-brochure.pdf');
  const targetPath = path.join(uploadRoot, relativePath);
  const curatedPdf = Buffer.from('%PDF-1.4\n% curated local brochure\n');
  const pngBytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
    0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99,
    0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
    0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, curatedPdf);
  fs.writeFileSync(seedPath, JSON.stringify({
    site: { siteKey: 'dma' },
    mediaAssets: [
      {
        assetKey: 'dma-lite-brochure',
        siteKey: 'dma',
        filename: 'dma-lite-brochure.pdf',
        mimeType: 'application/pdf',
        relativePath,
        sourceUrl: '',
      },
    ],
  }, null, 2));

  const server = http.createServer((request, response) => {
    if (request.url === '/mismatch.png') {
      response.writeHead(200, { 'content-type': 'image/png' });
      response.end(pngBytes);
      return;
    }

    response.writeHead(404);
    response.end();
  });
  const address = await listen(server);
  t.after(() => server.close());
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  fs.writeFileSync(seedPath, JSON.stringify({
    site: { siteKey: 'dma' },
    mediaAssets: [
      {
        assetKey: 'dma-lite-brochure',
        siteKey: 'dma',
        filename: 'dma-lite-brochure.pdf',
        mimeType: 'application/pdf',
        relativePath,
        sourceUrl: `http://${address.address}:${address.port}/mismatch.png`,
      },
    ],
  }, null, 2));

  const result = await runDownloadAssets([
    '--site', 'dma',
    '--seed', seedPath,
    '--upload-root', uploadRoot,
    '--asset-key', 'dma-lite-brochure',
    '--apply',
    '--force',
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mismatch|content-type|signature|expected/i);
  assert.deepEqual(fs.readFileSync(targetPath), curatedPdf);
  assert.deepEqual(
    fs.readdirSync(path.dirname(targetPath)).filter((entry) => entry.includes('.tmp')),
    [],
  );
});

test('seeded local repo assets are curated and structurally meaningful', () => {
  const pngAssets = [
    'public/uploads/seeds/dma/dma-hero-monitoring.png',
    'public/uploads/seeds/dma/dma-news-mnf.png',
    'public/uploads/seeds/bigfoot/bigfoot-hero-b8erp.png',
    'public/uploads/seeds/bigfoot/bigfoot-news-contract.png',
  ];
  const pdfAssets = [
    'public/uploads/seeds/dma/dma-lite-brochure.pdf',
    'public/uploads/seeds/dma/dma-lite-specs.pdf',
    'public/uploads/seeds/dma/dma-lite-solution-pack.pdf',
    'public/uploads/seeds/dma/dma-history-pack.pdf',
    'public/uploads/seeds/dma/dma-qingyuan-case-pack.pdf',
    'public/uploads/seeds/bigfoot/billing-suite-brochure.pdf',
    'public/uploads/seeds/bigfoot/billing-suite-specs.pdf',
    'public/uploads/seeds/bigfoot/smart-water-pack.pdf',
    'public/uploads/seeds/bigfoot/bigfoot-history-pack.pdf',
    'public/uploads/seeds/bigfoot/zhongshan-water-case-pack.pdf',
  ];
  const svgAssets = [
    'public/uploads/seeds/dma/dma-contact-qr.svg',
    'public/uploads/seeds/bigfoot/bigfoot-contact-qr.svg',
  ];

  for (const assetPath of pngAssets) {
    const buffer = fs.readFileSync(path.join(repoRoot, assetPath));
    const { width, height } = parsePngSize(buffer);
    assert.ok(width >= 640, `${assetPath} should be at least 640px wide`);
    assert.ok(height >= 360, `${assetPath} should be at least 360px tall`);
    assert.ok(buffer.length >= 1024, `${assetPath} should not be a tiny placeholder`);
  }

  for (const assetPath of pdfAssets) {
    const buffer = fs.readFileSync(path.join(repoRoot, assetPath));
    assert.match(buffer.subarray(0, 4).toString('ascii'), /%PDF/);
    assert.ok(buffer.length >= 1024, `${assetPath} should contain curated document content`);
    assert.equal(buffer.includes(Buffer.from('B8 seed asset')), false, `${assetPath} should not use placeholder copy`);
  }

  for (const assetPath of svgAssets) {
    const content = fs.readFileSync(path.join(repoRoot, assetPath), 'utf8');
    const rectCount = (content.match(/<rect\b/g) || []).length;
    assert.ok(content.length >= 1500, `${assetPath} should contain meaningful vector content`);
    assert.ok(rectCount >= 20, `${assetPath} should contain a QR-like grid instead of a placeholder label`);
  }
});
