import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const migrationRoot = path.join(projectRoot, 'data', 'migration');
const execFileAsync = promisify(execFile);
const inventoryDefaults = {
  siteKey: 'sample',
  baseUrl: 'https://example.com',
  pages: [],
  assets: [],
  downloads: [],
};

const DOWNLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.rar',
  '.7z',
  '.apk',
]);

const ASSET_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
]);

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&#x22;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'");
}

function normalizeAbsoluteUrl(rawUrl, baseUrl) {
  const decoded = decodeHtmlEntities(rawUrl.trim());

  if (
    !decoded ||
    decoded.startsWith('#') ||
    decoded.startsWith('javascript:') ||
    decoded.startsWith('mailto:') ||
    decoded.startsWith('tel:') ||
    decoded.startsWith('data:') ||
    decoded.startsWith('_script:')
  ) {
    return null;
  }

  const candidate = decoded.startsWith('//') ? `https:${decoded}` : decoded;

  try {
    return new URL(candidate, baseUrl);
  } catch {
    return null;
  }
}

function normalizePageEntry(url) {
  if (!url.search) {
    return url.pathname || '/';
  }

  const params = new URLSearchParams(url.searchParams);
  params.sort();
  const query = params.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}

function createDownloadEntry(url, siteKey) {
  const pathname = url.pathname || '/';
  const filename = pathname.split('/').filter(Boolean).pop() || 'download';
  const safeKey = `${siteKey}-${filename}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return {
    url: url.toString(),
    filename,
    assetKey: safeKey || `${siteKey}-download`,
  };
}

function buildInventoryFromString(html, { baseUrl = inventoryDefaults.baseUrl, siteKey = inventoryDefaults.siteKey } = {}) {
  const rootUrl = new URL(baseUrl);
  const pages = new Set();
  const assets = new Set();
  const downloads = new Map();
  const matches = [
    ...html.matchAll(/(?:href|src|data-src|data-original|poster)=["']([^"'<>]+)["']/gi),
    ...html.matchAll(/url\(([^)]+)\)/gi),
  ];

  for (const match of matches) {
    const rawValue = match[1].replace(/^["']|["']$/g, '');
    const normalized = normalizeAbsoluteUrl(rawValue, rootUrl);

    if (!normalized || !['http:', 'https:'].includes(normalized.protocol)) {
      continue;
    }

    const pathname = normalized.pathname.toLowerCase();
    const extension = path.extname(pathname);
    const sameOrigin = normalized.hostname === rootUrl.hostname;
    const hasPaginationQuery = [...normalized.searchParams.keys()].some((key) => key.toLowerCase().includes('pageno'));

    if (pathname === '/col.jsp' && hasPaginationQuery && !normalized.searchParams.get('id')) {
      continue;
    }

    if (DOWNLOAD_EXTENSIONS.has(extension) || pathname === '/download' || pathname.includes('/download/')) {
      const download = createDownloadEntry(normalized, siteKey);
      downloads.set(download.url, download);
      continue;
    }

    if (pathname === '/jzcusstyle.jsp') {
      continue;
    }

    if (ASSET_EXTENSIONS.has(extension) || pathname === '/qrcode.jsp') {
      assets.add(normalized.toString());
      continue;
    }

    if (!sameOrigin) {
      continue;
    }

    pages.add(normalizePageEntry(normalized));
  }

  return {
    siteKey,
    baseUrl: rootUrl.toString(),
    pages: [...pages].sort(),
    assets: [...assets].sort(),
    downloads: [...downloads.values()].sort((left, right) => left.url.localeCompare(right.url)),
  };
}

export async function buildInventoryFromHtml(filePath, options = {}) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  const html = await fs.readFile(absolutePath, 'utf8');
  return buildInventoryFromString(html, options);
}

async function fetchHtml(url) {
  const { stdout } = await execFileAsync(
    'curl',
    [
      '--compressed',
      '-L',
      '-A',
      'Mozilla/5.0 (compatible; b8-migration-crawler/1.0)',
      '-sSf',
      url,
    ],
    {
      maxBuffer: 10 * 1024 * 1024,
      encoding: 'utf8',
    },
  );

  return stdout;
}

function inventorySummary(siteKey, baseUrl, aggregate) {
  const pages = [...aggregate.pages].sort();
  const assets = [...aggregate.assets].sort();
  const downloads = [...aggregate.downloads.values()].sort((left, right) => left.url.localeCompare(right.url));

  return {
    siteKey,
    baseUrl,
    generatedAt: new Date().toISOString(),
    pages,
    assets,
    downloads,
    stats: {
      pageCount: pages.length,
      assetCount: assets.length,
      downloadCount: downloads.length,
    },
  };
}

export function buildRedirects(siteKey, baseUrl, pages) {
  const base = new URL(baseUrl);

  return pages
    .filter((page) => page !== '/')
    .map((page) => {
      const url = new URL(page, base);
      const sourceQuery = url.searchParams.toString();
      let targetPath = null;

      if (url.pathname === '/nd.jsp' && url.searchParams.get('id')) {
        targetPath = `/news/${url.searchParams.get('id')}`;
      } else if (url.pathname === '/pd.jsp' && url.searchParams.get('id')) {
        targetPath = `/products/${url.searchParams.get('id')}`;
      } else if (url.pathname === '/col.jsp' && url.searchParams.get('id')) {
        targetPath = `/pages/section-${url.searchParams.get('id')}`;
      } else if (url.pathname === '/nr.jsp') {
        targetPath = '/search';
      }

      return {
        siteKey,
        sourcePath: url.pathname,
        sourceQuery,
        targetPath,
        statusCode: 302,
      };
    })
    .filter((item) => item.targetPath);
}

export async function crawlSite({ siteKey, baseUrl, maxPages = 200 } = {}) {
  if (!siteKey || !baseUrl) {
    throw new Error('crawlSite requires both siteKey and baseUrl');
  }

  const queue = [new URL(baseUrl).toString()];
  const queued = new Set(queue);
  const visited = new Set();
  const aggregate = {
    pages: new Set(['/']),
    assets: new Set(),
    downloads: new Map(),
  };

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift();

    if (visited.has(currentUrl)) {
      continue;
    }

    visited.add(currentUrl);

    try {
      const html = await fetchHtml(currentUrl);
      const inventory = buildInventoryFromString(html, { baseUrl: currentUrl, siteKey });

      inventory.pages.forEach((page) => {
        aggregate.pages.add(page);
        const absolutePageUrl = new URL(page, baseUrl).toString();

        if (!queued.has(absolutePageUrl) && visited.size + queue.length < maxPages) {
          queued.add(absolutePageUrl);
          queue.push(absolutePageUrl);
        }
      });

      inventory.assets.forEach((asset) => aggregate.assets.add(asset));
      inventory.downloads.forEach((download) => aggregate.downloads.set(download.url, download));
    } catch {
      continue;
    }
  }

  const inventory = inventorySummary(siteKey, baseUrl, aggregate);
  inventory.redirects = buildRedirects(siteKey, baseUrl, inventory.pages);
  return inventory;
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function writeInventoryFiles({ siteKey, baseUrl, maxPages }) {
  const siteInventoryPath = path.join(migrationRoot, siteKey, 'inventory.json');
  const redirectsPath = path.join(migrationRoot, 'redirects.json');
  const crawledInventory = await crawlSite({ siteKey, baseUrl, maxPages });
  let inventory = crawledInventory;

  try {
    const current = JSON.parse(await fs.readFile(siteInventoryPath, 'utf8'));
    const currentScore = (current.stats?.pageCount || current.pages?.length || 0)
      + (current.stats?.assetCount || current.assets?.length || 0)
      + (current.stats?.downloadCount || current.downloads?.length || 0);
    const crawledScore = crawledInventory.stats.pageCount + crawledInventory.stats.assetCount + crawledInventory.stats.downloadCount;

    if (currentScore > crawledScore) {
      inventory = {
        ...current,
        siteKey,
        baseUrl,
        generatedAt: new Date().toISOString(),
      };
      inventory.redirects = buildRedirects(siteKey, baseUrl, inventory.pages);
      inventory.stats = {
        pageCount: inventory.pages.length,
        assetCount: inventory.assets.length,
        downloadCount: inventory.downloads.length,
      };
    }
  } catch {
    inventory = crawledInventory;
  }

  await writeJson(siteInventoryPath, inventory);

  let existingRedirects = [];

  try {
    const current = await fs.readFile(redirectsPath, 'utf8');
    existingRedirects = JSON.parse(current);
  } catch {
    existingRedirects = [];
  }

  const mergedRedirects = [
    ...existingRedirects.filter((item) => item.siteKey !== siteKey),
    ...inventory.redirects,
  ].sort((left, right) => {
    const siteCompare = left.siteKey.localeCompare(right.siteKey);
    if (siteCompare !== 0) {
      return siteCompare;
    }

    const pathCompare = left.sourcePath.localeCompare(right.sourcePath);
    if (pathCompare !== 0) {
      return pathCompare;
    }

    return left.sourceQuery.localeCompare(right.sourceQuery);
  });

  await writeJson(redirectsPath, mergedRedirects);
  return inventory;
}

function parseCliArgs(argv) {
  const args = { siteKey: null, baseUrl: null, maxPages: 200 };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (key === '--site') {
      args.siteKey = value;
      index += 1;
    } else if (key === '--base-url') {
      args.baseUrl = value;
      index += 1;
    } else if (key === '--max-pages') {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('--max-pages must be a positive integer');
      }
      args.maxPages = parsed;
      index += 1;
    }
  }

  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let parsedArgs;

  try {
    parsedArgs = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }

  if (!parsedArgs) {
    process.exitCode = process.exitCode || 1;
  } else {
    const { siteKey, baseUrl, maxPages } = parsedArgs;

    if (!siteKey || !baseUrl) {
      console.error('Usage: node scripts/crawl-site.mjs --site <site-key> --base-url <base-url> [--max-pages <count>]');
      process.exitCode = 1;
    } else {
      const inventory = await writeInventoryFiles({ siteKey, baseUrl, maxPages });
      console.log(`Captured ${inventory.stats.pageCount} pages, ${inventory.stats.assetCount} assets, and ${inventory.stats.downloadCount} downloads for ${siteKey}.`);
    }
  }
}
