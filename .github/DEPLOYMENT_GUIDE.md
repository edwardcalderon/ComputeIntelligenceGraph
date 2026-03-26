# Unified GitHub Pages Deployment Guide

## Overview

The Landing Page and Documentation are now deployed together to GitHub Pages via a single unified workflow. The documentation is served at `/documentation` path while the landing page is served at the root.

## Deployment Structure

```
GitHub Pages Root (https://edwardcalderon.github.io/ComputeIntelligenceGraph/)
├── / (Landing Page)
│   ├── index.html
│   ├── about/
│   ├── features/
│   └── ...
└── /documentation (Docusaurus Docs)
    ├── index.html
    ├── docs/
    ├── api/
    └── ...
```

## Workflow: `deploy-landing.yml`

### Triggers

The unified workflow is triggered by:

1. **Branch Push to Main** (with path detection)
   - Deploys only if landing or docs files changed
   - Skips deployment if only other files changed

2. **Git Tags** (v*.*.*)
   - Always deploys both landing and docs
   - Triggered on tag push

3. **GitHub Release**
   - Always deploys both landing and docs
   - Triggered on release publication

4. **Manual Trigger** (workflow_dispatch)
   - Always deploys both landing and docs
   - Can be triggered from Actions tab

### Path Detection

The workflow monitors these paths for changes:

**Landing Page Changes:**
- `apps/landing/**`
- `packages/auth/**`
- `packages/ui/**`
- `release-metadata.json`
- `.github/workflows/deploy-landing.yml`

**Documentation Changes:**
- `apps/docs/**`
- `.github/workflows/deploy-landing.yml`

### Build Process

1. **Checkout** - Fetch repository code
2. **Setup Node.js** - Install Node.js 22
3. **Setup pnpm** - Install pnpm 9
4. **Cache Dependencies** - Use pnpm cache for faster builds
5. **Install Dependencies** - Run `pnpm install --frozen-lockfile`
6. **Build Landing** - Run `pnpm --filter @cig/landing build` (if changed)
7. **Build Docs** - Run `pnpm --filter @cig/docs build` (if changed)
8. **Prepare Deployment** - Combine outputs into single directory:
   - Landing output → `deploy/`
   - Docs output → `deploy/documentation/`
9. **Upload Artifact** - Upload combined directory to GitHub Pages
10. **Deploy** - Deploy artifact to GitHub Pages

### Deployment Directory Structure

```
deploy/
├── index.html (landing)
├── about/ (landing)
├── features/ (landing)
├── _next/ (landing)
├── documentation/
│   ├── index.html (docs)
│   ├── docs/ (docs)
│   ├── api/ (docs)
│   └── _next/ (docs)
└── ...
```

## Environment Variables

The workflow uses these environment variables for the landing build:

```yaml
NODE_ENV: production
NEXT_PUBLIC_SITE_URL: https://cig.lat
NEXT_PUBLIC_API_URL: https://api.cig.technology
NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
NEXT_PUBLIC_DASHBOARD_URL: ${{ secrets.NEXT_PUBLIC_DASHBOARD_URL }}
```

## Accessing Deployed Content

After deployment, content is available at:

- **Landing Page**: https://edwardcalderon.github.io/ComputeIntelligenceGraph/
- **Documentation**: https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/

## Local Testing

### Build Landing Locally

```bash
pnpm --filter @cig/landing build
```

### Build Docs Locally

```bash
pnpm --filter @cig/docs build
```

### Simulate Deployment Structure

```bash
mkdir -p deploy
cp -r apps/landing/out/* deploy/
mkdir -p deploy/documentation
cp -r apps/docs/build/* deploy/documentation/
```

### Serve Locally

```bash
# Using Python 3
python -m http.server 8000 --directory deploy

# Using Node.js
npx http-server deploy -p 8000
```

Then visit: http://localhost:8000/

## Troubleshooting

### Deployment Failed

1. Check GitHub Actions logs: https://github.com/edwardcalderon/ComputeIntelligenceGraph/actions
2. Look for build errors in the workflow output
3. Verify all environment secrets are configured
4. Check that landing and docs build successfully locally

### Landing Page Not Showing

1. Verify landing build output exists: `apps/landing/out/`
2. Check that `index.html` is in the root of the output
3. Verify GitHub Pages is enabled in repository settings

### Documentation Not Showing at /documentation

1. Verify docs build output exists: `apps/docs/build/`
2. Check that `index.html` is in the root of the docs output
3. Verify the deployment directory structure is correct
4. Check browser console for 404 errors

### Stale Content After Deployment

1. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
3. Wait 5-10 minutes for GitHub Pages CDN to update
4. Check GitHub Pages deployment status in repository settings

## Configuration

### GitHub Pages Settings

1. Go to repository Settings → Pages
2. Ensure "Source" is set to "Deploy from a branch"
3. Ensure "Branch" is set to "gh-pages" with "/" (root) folder
4. Custom domain is optional (not required for this setup)

### Required Secrets

The following secrets must be configured in repository settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DASHBOARD_URL`

## Performance Optimization

The workflow includes several optimizations:

1. **Conditional Builds** - Only builds changed apps
2. **Dependency Caching** - Caches pnpm dependencies
3. **Concurrent Builds** - Landing and docs can be built in parallel (future enhancement)
4. **Artifact Caching** - GitHub caches build artifacts

## Future Enhancements

Potential improvements to the deployment workflow:

1. **Parallel Builds** - Build landing and docs simultaneously
2. **Lighthouse CI** - Run performance tests before deployment
3. **Link Validation** - Validate all links before deployment
4. **Preview Deployments** - Deploy PRs to preview URLs
5. **Rollback Capability** - Automatic rollback on deployment failure
6. **Deployment Notifications** - Slack/Discord notifications on deployment

## Related Files

- Workflow: `.github/workflows/deploy-landing.yml`
- Landing Config: `apps/landing/next.config.js`
- Docs Config: `apps/docs/docusaurus.config.ts`
- Landing Package: `apps/landing/package.json`
- Docs Package: `apps/docs/package.json`
