# Deployment Quick Start

## What Changed?

✅ **Unified Deployment**: Landing page and documentation now deploy together in a single GitHub Actions workflow.

✅ **Single Workflow**: Replaced separate `docs-deploy.yml` with integrated `deploy-landing.yml`

✅ **Documentation Path**: Docs are served at `/documentation` instead of root

✅ **Smart Builds**: Only builds changed apps (landing or docs)

## Deployment URLs

After deployment, access your content at:

```
Landing Page:    https://edwardcalderon.github.io/ComputeIntelligenceGraph/
Documentation:   https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/
```

## How to Deploy

### Automatic Deployment (Recommended)

Just push to main:

```bash
git push origin main
```

The workflow automatically detects changes and deploys:
- Landing page if `apps/landing/**` changed
- Documentation if `apps/docs/**` changed
- Both if either changed

### Manual Deployment

Trigger from GitHub Actions:

1. Go to: https://github.com/edwardcalderon/ComputeIntelligenceGraph/actions
2. Select "Deploy Landing & Documentation → GitHub Pages"
3. Click "Run workflow"
4. Select branch (main)
5. Click "Run workflow"

### Deploy on Release

Create a git tag to deploy:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Or create a GitHub Release - both trigger automatic deployment.

## Build Locally

### Build Landing

```bash
pnpm --filter @cig/landing build
```

Output: `apps/landing/out/`

### Build Docs

```bash
pnpm --filter @cig/docs build
```

Output: `apps/docs/build/`

### Build Both

```bash
pnpm build
```

## Test Locally

Simulate the deployment structure:

```bash
# Create deployment directory
mkdir -p deploy
cp -r apps/landing/out/* deploy/
mkdir -p deploy/documentation
cp -r apps/docs/build/* deploy/documentation/

# Serve locally
python -m http.server 8000 --directory deploy
```

Then visit: http://localhost:8000/

## Workflow Status

Check deployment status:

1. Go to: https://github.com/edwardcalderon/ComputeIntelligenceGraph/actions
2. Look for "Deploy Landing & Documentation → GitHub Pages"
3. Click the latest run to see details

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment failed | Check GitHub Actions logs for build errors |
| Landing not showing | Verify `apps/landing/out/index.html` exists |
| Docs not at /documentation | Verify `apps/docs/build/` exists and was copied |
| Stale content | Clear browser cache and hard refresh |
| 404 errors | Check that files were built and deployed correctly |

## Files Changed

- ✅ `.github/workflows/deploy-landing.yml` - Updated with unified workflow
- ✅ `.github/workflows/docs-deploy.yml` - Deleted (integrated into deploy-landing.yml)
- ✅ `.github/DEPLOYMENT_GUIDE.md` - Created (detailed guide)
- ✅ `.github/DEPLOYMENT_QUICK_START.md` - Created (this file)

## Next Steps

1. ✅ Verify GitHub Pages is enabled in repository settings
2. ✅ Ensure all required secrets are configured
3. ✅ Push to main to trigger first deployment
4. ✅ Check GitHub Actions for successful deployment
5. ✅ Visit deployment URLs to verify content

## Questions?

See `.github/DEPLOYMENT_GUIDE.md` for detailed documentation.
