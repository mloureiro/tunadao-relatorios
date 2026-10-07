# Vendored dependencies

## SheetJS CE 0.20.3

The `xlsx` package on the npm registry is outdated, so SheetJS Community Edition is installed from the tarball
published on its official CDN and committed here.

- File: `xlsx-0.20.3.tgz`
- Source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- Referenced from `package.json` as `"xlsx": "file:vendor/xlsx-0.20.3.tgz"`

Verify with `shasum -a 256 vendor/xlsx-0.20.3.tgz`.
