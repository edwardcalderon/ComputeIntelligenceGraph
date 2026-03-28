# GitHub Workflows & Deployment

This directory contains GitHub Actions workflows and deployment documentation for the CIG project.

## Workflows

### Deploy Landing & Documentation → GitHub Pages

**File**: `deploy-landing.yml`

Unified workflow that deploys both the landing page and documentation to GitHub Pages.

**Triggers:**
- Push to main (with path detection)
- Git tags (v*.*.*)
- GitHub releases
- Manual workflow dispatch

**Deployment:**
- Landing page: Root (/)
- Documentation: /documentation

**Status**: ✅ Active

## Documentation

### Quick Start
**File**: `DEPLOYMENT_QUICK_START.md`

Quick reference guide for common deployment tasks.

**Contents:**
- Deployment URLs
- How to deploy
- Build locally
- Test locally
- Troubleshooting table

### Detailed Guide
**File**: `DEPLOYMENT_GUIDE.md`

Comprehensive deployment documentation.

**Contents:**
- Overview and structure
- Workflow details
- Build process
- Environment variables
- Troubleshooting
- Configuration
- Performance optimization

### Deployment Structure
**File**: `DEPLOYMENT_STRUCTURE.md`

Detailed directory structure and file organization.

**Contents:**
- GitHub Pages structure
- Build output directories
- Deployment process
- URL mapping
- File size estimates
- Caching strategy
- Performance metrics

### Refactor Summary
**File**: `DEPLOYMENT_REFACTOR_SUMMARY.md`

Summary of the deployment refactor.

**Contents:**
- What was changed
- Before/after comparison
- Benefits
- Migration steps
- Testing instructions

### Docs Deployment
**File**: `../apps/docs/DEPLOYMENT.md`

Documentation-specific deployment information.

**Contents:**
- Build process
- Deployment triggers
- Content structure
- Local development
- Troubleshooting
- Performance and security

## Quick Links

| Task | File |
|------|------|
| Deploy now | `DEPLOYMENT_QUICK_START.md` |
| Understand workflow | `DEPLOYMENT_GUIDE.md` |
| See file structure | `DEPLOYMENT_STRUCTURE.md` |
| Learn about refactor | `DEPLOYMENT_REFACTOR_SUMMARY.md` |
| Docs deployment | `../apps/docs/DEPLOYMENT.md` |

## Deployment URLs

After deployment, content is available at:

- **Landing Page**: https://edwardcalderon.github.io/ComputeIntelligenceGraph/
- **Documentation**: https://edwardcalderon.github.io/ComputeIntelligenceGraph/documentation/

## How to Deploy

### Automatic (Recommended)

```bash
git push origin main
```

The workflow automatically detects changes and deploys.

### Manual

1. Go to: https://github.com/edwardcalderon/ComputeIntelligenceGraph/actions
2. Select "Deploy Landing & Documentation → GitHub Pages"
3. Click "Run workflow"

### On Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Build Locally

```bash
# Build both
pnpm build

# Or individually
pnpm --filter @cig/landing build
pnpm --filter @cig/docs build
```

## Test Locally

```bash
# Create deployment directory
mkdir -p deploy
cp -r apps/landing/out/* deploy/
mkdir -p deploy/documentation
cp -r apps/docs/build/* deploy/documentation/

# Serve locally
python -m http.server 8000 --directory deploy
```

Visit: http://localhost:8000/

## Workflow Status

Check deployment status:

1. Go to: https://github.com/edwardcalderon/ComputeIntelligenceGraph/actions
2. Look for "Deploy Landing & Documentation → GitHub Pages"
3. Click the latest run to see details

## Environment Secrets

The following secrets must be configured in repository settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DASHBOARD_URL`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deployment failed | Check GitHub Actions logs |
| Landing not showing | Verify `apps/landing/out/` exists |
| Docs not at /documentation | Verify `apps/docs/build/` exists |
| Stale content | Clear browser cache and hard refresh |
| 404 errors | Check file structure and URLs |

See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting.

## Key Features

✅ **Unified Workflow** - Single workflow for landing and docs
✅ **Smart Builds** - Only builds changed apps
✅ **Path Detection** - Automatic change detection
✅ **Dependency Caching** - Fast builds with caching
✅ **Documentation** - Comprehensive guides included
✅ **Organized Structure** - Clear directory organization
✅ **Easy Deployment** - Simple push-to-deploy workflow

## Files

```
.github/
├── workflows/
│   └── deploy-landing.yml              # Main deployment workflow
├── README.md                           # This file
├── DEPLOYMENT_GUIDE.md                 # Detailed guide
├── DEPLOYMENT_QUICK_START.md           # Quick reference
├── DEPLOYMENT_STRUCTURE.md             # Directory structure
├── DEPLOYMENT_REFACTOR_SUMMARY.md      # Refactor summary
└── DEPLOYMENT.md                       # Docs deployment info

apps/docs/
└── DEPLOYMENT.md                       # Docs-specific deployment
```

## Next Steps

1. ✅ Review `DEPLOYMENT_QUICK_START.md`
2. ✅ Verify GitHub Pages is enabled
3. ✅ Ensure all secrets are configured
4. ✅ Push to main to trigger deployment
5. ✅ Check GitHub Actions for status
6. ✅ Visit deployment URLs to verify

## Questions?

- **Quick answers**: See `DEPLOYMENT_QUICK_START.md`
- **Detailed info**: See `DEPLOYMENT_GUIDE.md`
- **Structure details**: See `DEPLOYMENT_STRUCTURE.md`
- **Docs info**: See `apps/docs/DEPLOYMENT.md`

## Related

- Landing Page: `apps/landing/`
- Documentation: `apps/docs/`
- Monorepo: Root `package.json` and `turbo.json`
