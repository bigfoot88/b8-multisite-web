const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { createDatabase } = require('../src/lib/db');
const { createSiteRepository } = require('../src/repositories/site-repository');
const { createAdminRepository } = require('../src/repositories/admin-repository');

test('seed-admin seeds only the default admin and basic site rows', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-seed-admin-'));
  const dbPath = path.join(tempDir, 'content.db');

  try {
    execFileSync(process.execPath, ['scripts/seed-admin.mjs'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        DATABASE_PATH: dbPath,
      },
      stdio: 'pipe',
    });

    const db = createDatabase(dbPath);
    const admins = createAdminRepository(db);
    const sites = createSiteRepository(db);

    assert.equal(admins.listAdmins().length, 1);
    assert.equal(admins.listAdmins()[0].username, 'admin');
    assert.deepEqual(
      sites.listSiteSettings().map(({ siteKey, brandName, domain, seoTitle, seoDescription, contactEmail, contactPhone, contactAddress }) => ({
        siteKey,
        brandName,
        domain,
        seoTitle,
        seoDescription,
        contactEmail,
        contactPhone,
        contactAddress,
      })),
      [
        {
          siteKey: 'bigfoot',
          brandName: 'Bigfoot',
          domain: 'bigfoot.local',
          seoTitle: null,
          seoDescription: null,
          contactEmail: null,
          contactPhone: null,
          contactAddress: null,
        },
        {
          siteKey: 'dma',
          brandName: 'DMA',
          domain: 'dma.local',
          seoTitle: null,
          seoDescription: null,
          contactEmail: null,
          contactPhone: null,
          contactAddress: null,
        },
      ],
    );

    assert.equal(sites.listNavigation('dma').length, 0);
    assert.equal(sites.listNavigation('bigfoot').length, 0);
    assert.equal(sites.listSections('dma').length, 0);
    assert.equal(sites.listSections('bigfoot').length, 0);

    db.close();
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
