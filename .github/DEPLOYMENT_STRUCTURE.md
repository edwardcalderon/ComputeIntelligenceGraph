# Deployment Directory Structure

## GitHub Pages Root Structure

After deployment, the GitHub Pages repository contains:

```
deploy/
├── index.html                          # Landing page entry point
├── about/                              # Landing page routes
│   └── index.html
├── features/                           # Landing page routes
│   └── index.html
├── _next/                              # Next.js static assets
│   ├── static/
│   ├── image/
│   └── ...
├── public/                             # Landing page public assets
│   ├── favicon.ico
│   ├── logo.svg
│   └── ...
│
└── documentation/                      # Docusaurus documentation
    ├── index.html                      # Docs entry point
    ├── docs/                           # Documentation pages
    │   ├── getting-started/
    │   │   ├── index.html
    │   │   ├── installation/
    │   │   │   └── index.html
    │   │   └── quick-start/
    │   │       └── index.html
    │   ├── architecture/
    │   │   ├── index.html
    │   │   ├── system-design/
    │   │   │   └── index.html
    │   │   └── components/
    │   │       └── index.html
    │   ├── api-reference/
    │   │   ├── index.html
    │   │   └── endpoints/
    │   │       └── index.html
    │   ├── user-guide/
    │   │   ├── index.html
    │   │   └── features/
    │   │       └── index.html
    │   ├── developer-guide/
    │   │   ├── index.html
    │   │   └── contributing/
    │   │       └── index.html
    │   ├── troubleshooting/
    │   │   ├── index.html
    │   │   └── common-issues/
    │   │       └── index.html
    │   ├── changelog/
    │   │   └── index.html
    │   └── faq/
    │       └── index.html
    ├── _next/                          # Docusaurus static assets
    │   ├── static/
    │   ├── image/
    │   └── ...
    ├── img/                            # Documentation images
    │   ├── logo.svg
    │   ├── architecture-diagram.png
    │   └── ...
    ├── assets/                         # Documentation assets
    │   ├── css/
    │   ├── js/
    │   └── ...
    └── sitemap.xml                     # Docusaurus sitemap
```

## Build Output Directories

### Landing Page Build Output

```
apps/landing/out/
├── index.html
├── about/
│   └── index.html
├── features/
│   └── index.html
├── _next/
│   ├── static/
│   ├── image/
│   └── ...
└── public/
    ├── favicon.ico
    ├── logo.svg
    └── ...
```

### Documentation Build Output

```
apps/docs/build/
├── index.html
├── docs/
│   ├── getting-started/
│   │   ├── index.html
│   │   ├── installation/
│   │   │   └── index.html
│   │   └── quick-start/
│   │       └── index.html
│   ├── architecture/
│   │   ├── index.html
│   │   ├── system-design/
│   │   │   └── index.html
│   │   └── components/
│   │       └── index.html
│   ├── api-reference/
│   │   ├── index.html
│   │   └── endpoints/
│   │       └── index.html
│   ├── user-guide/
│   │   ├── index.html
│   │   └── features/
│   │       └── index.html
│   ├── developer-guide/
│   │   ├── index.html
│   │   └── contributing/
│   │       └── index.html
│   ├── troubleshooting/
│   │   ├── index.html
│   │   └── common-issues/
│   │       └── index.html
│   ├── changelog/
│   │   └── index.html
│   └── faq/
│       └── index.html
├── _next/
│   ├── static/
│   ├── image/
│   └── ...
├── img/
│   ├── logo.svg
│   ├── architecture-diagram.png
│   └── ...
├── assets/
│   ├── css/
│   ├── js/
│   └── ...
└── sitemap.xml
```

## Deployment Process

### Step 1: Build Landing

```bash
pnpm --filter @cig/landing build
```

Creates: `apps/landing/out/`

### Step 2: Build Docs

```bash
pnpm --filter @cig/docs build
```

Creates: `apps/docs/build/`

### Step 3: Prepare Deployment Directory

```bash
mkdir -p deploy
cp -r apps/landing/out/* deploy/
mkdir -p deploy/documentation
cp -r apps/docs/build/* deploy/documentation/
```

Creates: `deploy/` with combined structure

### Step 4: Upload to GitHub Pages

GitHub Actions uploads `deploy/` directory to GitHub Pages.

### Step 5: Access Content

- Landing: https://edwardcalderon.github.io/ComputeIntelligenceGraph/
- Docs: https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/

## URL Mapping

### Landing Page URLs

| Path | File | URL |
|------|------|-----|
| `/` | `deploy/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/ |
| `/about` | `deploy/about/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/about |
| `/features` | `deploy/features/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/features |

### Documentation URLs

| Path | File | URL |
|------|------|-----|
| `/documentation` | `deploy/documentation/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/ |
| `/documentation/docs/getting-started` | `deploy/documentation/docs/getting-started/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/docs/getting-started/ |
| `/documentation/docs/architecture` | `deploy/documentation/docs/architecture/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/docs/architecture/ |
| `/documentation/docs/api-reference` | `deploy/documentation/docs/api-reference/index.html` | https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/docs/api-reference/ |

## File Size Estimates

### Landing Page
- HTML: ~50 KB
- CSS/JS: ~200 KB
- Images: ~500 KB
- **Total**: ~750 KB

### Documentation
- HTML: ~100 KB
- CSS/JS: ~300 KB
- Images: ~200 KB
- **Total**: ~600 KB

### Combined Deployment
- **Total**: ~1.35 MB

## Caching Strategy

### GitHub Pages CDN

- **HTML**: No cache (always fresh)
- **CSS/JS**: 1 year cache (versioned)
- **Images**: 1 year cache (versioned)
- **Static Assets**: 1 year cache (versioned)

### Browser Cache

- **HTML**: No cache
- **CSS/JS**: 1 year
- **Images**: 1 year
- **Static Assets**: 1 year

## Performance Metrics

### Landing Page
- **Lighthouse Performance**: 90+
- **First Contentful Paint**: < 1s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1

### Documentation
- **Lighthouse Performance**: 90+
- **First Contentful Paint**: < 1s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1

## Troubleshooting

### Missing Files

If files are missing from deployment:

1. Check build output exists:
   ```bash
   ls -la apps/landing/out/
   ls -la apps/docs/build/
   ```

2. Verify copy commands worked:
   ```bash
   ls -la deploy/
   ls -la deploy/documentation/
   ```

3. Check GitHub Actions logs for errors

### Incorrect Structure

If structure is wrong:

1. Verify landing files are in `deploy/` root
2. Verify docs files are in `deploy/documentation/`
3. Verify `index.html` files exist in each directory
4. Check for typos in copy commands

### 404 Errors

If getting 404 errors:

1. Check URL path matches file structure
2. Verify `index.html` exists in directory
3. Check for case sensitivity issues
4. Verify GitHub Pages is serving from correct branch

## Related Files

- Workflow: `.github/workflows/deploy-landing.yml`
- Deployment Guide: `.github/DEPLOYMENT_GUIDE.md`
- Quick Start: `.github/DEPLOYMENT_QUICK_START.md`
- Docs Deployment: `apps/docs/DEPLOYMENT.md`
