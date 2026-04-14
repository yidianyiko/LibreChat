const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../../../..');

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Playwright local web server config', () => {
  it('builds frontend artifacts before starting the backend', () => {
    const mainConfig = readProjectFile('e2e/playwright.config.ts');
    expect(mainConfig).toMatch(/npm run frontend && node \$\{absolutePath\}/);
    expect(mainConfig).toMatch(/timeout:\s*420_000/);
  });

  it('does not override the build-first startup command in local configs', () => {
    const localConfig = readProjectFile('e2e/playwright.config.local.ts');
    const a11yConfig = readProjectFile('e2e/playwright.config.a11y.ts');

    expect(localConfig).not.toMatch(/command:\s*`node \$\{absolutePath\}`/);
    expect(a11yConfig).not.toMatch(/command:\s*`node \$\{absolutePath\}`/);
    expect(localConfig).not.toMatch(/globalSetup:\s*require\.resolve\('\.\/setup\/global-setup\.local'\)/);
    expect(a11yConfig).not.toMatch(
      /globalSetup:\s*require\.resolve\('\.\/setup\/global-setup\.local'\)/,
    );
    expect(localConfig).toMatch(/workers:\s*1/);
    expect(localConfig).toMatch(/reuseExistingServer:\s*false/);
    expect(a11yConfig).toMatch(/reuseExistingServer:\s*false/);
    expect(localConfig).toMatch(/baseURL:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(localConfig).toMatch(/url:\s*'http:\/\/127\.0\.0\.1:3180\/health'/);
    expect(localConfig).not.toMatch(/port:\s*3180/);
    expect(localConfig).toMatch(/PORT:\s*'3180'/);
    expect(localConfig).toMatch(/DOMAIN_CLIENT:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(localConfig).toMatch(/DOMAIN_SERVER:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(localConfig).toMatch(/CORS_ALLOWED_ORIGINS:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(localConfig).toMatch(/SSE_ALLOWED_ORIGINS:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(a11yConfig).toMatch(/baseURL:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(a11yConfig).toMatch(/url:\s*'http:\/\/127\.0\.0\.1:3180\/health'/);
    expect(a11yConfig).not.toMatch(/port:\s*3180/);
    expect(a11yConfig).toMatch(/PORT:\s*'3180'/);
    expect(a11yConfig).toMatch(/DOMAIN_CLIENT:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(a11yConfig).toMatch(/DOMAIN_SERVER:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(a11yConfig).toMatch(/CORS_ALLOWED_ORIGINS:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(a11yConfig).toMatch(/SSE_ALLOWED_ORIGINS:\s*'http:\/\/127\.0\.0\.1:3180'/);
    expect(localConfig).toMatch(/name:\s*'setup'/);
    expect(localConfig).toMatch(/dependencies:\s*\['setup'\]/);
    expect(a11yConfig).toMatch(/name:\s*'setup'/);
    expect(a11yConfig).toMatch(/dependencies:\s*\['setup'\]/);
  });

  it('uses baseURL-driven paths instead of hardcoded localhost test URLs', () => {
    const e2eFiles = [
      'e2e/specs/landing.spec.ts',
      'e2e/specs/messages.spec.ts',
      'e2e/specs/nav.spec.ts',
      'e2e/specs/popup.spec.ts',
      'e2e/specs/recharge.spec.ts',
      'e2e/specs/settings.spec.ts',
      'e2e/specs/a11y.spec.ts',
    ];

    for (const file of e2eFiles) {
      expect(readProjectFile(file)).not.toContain('http://localhost:3080');
    }
  });
});
