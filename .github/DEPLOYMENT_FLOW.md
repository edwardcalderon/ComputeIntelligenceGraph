# Deployment Flow Diagram

## High-Level Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workflow                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  git push main  │
                    └─────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  GitHub Actions Workflow Triggered      │
        │  (deploy-landing.yml)                   │
        └─────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ Detect Changes   │        │ Setup Environment│
        │ (paths filter)   │        │ (Node, pnpm)     │
        └──────────────────┘        └──────────────────┘
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ Landing changed? │        │ Install Deps     │
        │ Docs changed?    │        │ (with cache)     │
        └──────────────────┘        └──────────────────┘
                │                           │
        ┌───────┴───────┐                  │
        │               │                  │
        ▼               ▼                  │
    ┌────────┐     ┌────────┐             │
    │Landing │     │  Docs  │             │
    │changed?│     │changed?│             │
    └────────┘     └────────┘             │
        │               │                  │
        ▼               ▼                  ▼
    ┌────────┐     ┌────────┐        ┌──────────────┐
    │ Build  │     │ Build  │        │ Prepare      │
    │Landing │     │  Docs  │        │ Deploy Dir   │
    └────────┘     └────────┘        └──────────────┘
        │               │                  │
        ▼               ▼                  ▼
    ┌────────┐     ┌────────┐        ┌──────────────┐
    │ Output │     │ Output │        │ Copy Landing │
    │ to:    │     │ to:    │        │ to deploy/   │
    │landing/│     │docs/   │        └──────────────┘
    │out/    │     │build/  │                │
    └────────┘     └────────┘                ▼
        │               │            ┌──────────────┐
        └───────┬───────┘            │ Copy Docs to │
                │                    │ deploy/docs/ │
                │                    └──────────────┘
                │                           │
                └───────────┬───────────────┘
                            │
                            ▼
                ┌─────────────────────────┐
                │ Upload Artifact to      │
                │ GitHub Pages            │
                └─────────────────────────┘
                            │
                            ▼
                ┌─────────────────────────┐
                │ Deploy to GitHub Pages  │
                └─────────────────────────┘
                            │
                            ▼
        ┌─────────────────────────────────────────┐
        │  Content Available at:                  │
        │  - Landing: /                           │
        │  - Docs: /documentation/                │
        └─────────────────────────────────────────┘
```

## Detailed Build Process

```
┌──────────────────────────────────────────────────────────────┐
│                    Build Landing Page                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ pnpm --filter       │
                    │ @cig/landing build  │
                    └─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ Compile Next.js  │        │ Optimize Assets  │
        │ Components       │        │ (images, CSS)    │
        └──────────────────┘        └──────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Output to:          │
                    │ apps/landing/out/   │
                    └─────────────────────┘


┌──────────────────────────────────────────────────────────────┐
│                    Build Documentation                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ pnpm --filter       │
                    │ @cig/docs build     │
                    └─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ Parse Markdown   │        │ Render React     │
        │ Files            │        │ Components       │
        └──────────────────┘        └──────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Generate Static     │
                    │ HTML Pages          │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Output to:          │
                    │ apps/docs/build/    │
                    └─────────────────────┘
```

## Deployment Directory Assembly

```
┌──────────────────────────────────────────────────────────────┐
│                  Prepare Deploy Directory                    │
└──────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ apps/landing/out │        │ apps/docs/build  │
        │                  │        │                  │
        │ ├── index.html   │        │ ├── index.html   │
        │ ├── about/       │        │ ├── docs/        │
        │ ├── features/    │        │ ├── _next/       │
        │ ├── _next/       │        │ └── img/         │
        │ └── public/      │        └──────────────────┘
        └──────────────────┘                │
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ Copy to deploy/  │        │ Copy to deploy/  │
        │                  │        │ documentation/   │
        └──────────────────┘        └──────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ deploy/             │
                    │ ├── index.html      │
                    │ ├── about/          │
                    │ ├── features/       │
                    │ ├── _next/          │
                    │ ├── public/         │
                    │ └── documentation/  │
                    │     ├── index.html  │
                    │     ├── docs/       │
                    │     ├── _next/      │
                    │     └── img/        │
                    └─────────────────────┘
```

## GitHub Pages Deployment

```
┌──────────────────────────────────────────────────────────────┐
│                  Upload to GitHub Pages                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Upload artifact     │
                    │ (deploy/ directory) │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Deploy to gh-pages  │
                    │ branch              │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ GitHub Pages        │
                    │ Processes Files     │
                    └─────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌──────────────────┐        ┌──────────────────┐
        │ Serve at /       │        │ Serve at /docs/  │
        │ (Landing Page)   │        │ (Documentation)  │
        └──────────────────┘        └──────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  Available at GitHub Pages URL:         │
        │  https://edwardcalderon.github.io/      │
        │  ComputeIntelligenceGraph/              │
        │                                         │
        │  - Landing: /                           │
        │  - Docs: /documentation/                │
        └─────────────────────────────────────────┘
```

## Workflow Decision Tree

```
                    ┌─────────────────┐
                    │ Event Triggered │
                    └─────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Push to  │  │ Git Tag  │  │ Release  │
        │ main?    │  │ v*.*.*?  │  │ Created? │
        └──────────┘  └──────────┘  └──────────┘
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Detect   │  │ Build    │  │ Build    │
        │ Changes  │  │ Both     │  │ Both     │
        └──────────┘  └──────────┘  └──────────┘
                │             │             │
                ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Landing  │  │ Deploy   │  │ Deploy   │
        │ changed? │  │ to Pages │  │ to Pages │
        │ Docs     │  └──────────┘  └──────────┘
        │ changed? │
        └──────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
    ┌────────┐     ┌────────┐
    │ Build  │     │ Build  │
    │ Both   │     │ Only   │
    │        │     │ Changed│
    └────────┘     └────────┘
        │               │
        └───────┬───────┘
                │
                ▼
        ┌──────────────┐
        │ Deploy to    │
        │ GitHub Pages │
        └──────────────┘
```

## Trigger Conditions

```
┌─────────────────────────────────────────────────────────────┐
│                  Workflow Triggers                          │
└─────────────────────────────────────────────────────────────┘

1. BRANCH PUSH (main)
   ├─ Detect changes
   ├─ Landing changed? → Build landing
   ├─ Docs changed? → Build docs
   └─ Deploy if either changed

2. GIT TAG (v*.*.*)
   ├─ Always build landing
   ├─ Always build docs
   └─ Always deploy

3. GITHUB RELEASE
   ├─ Always build landing
   ├─ Always build docs
   └─ Always deploy

4. MANUAL DISPATCH
   ├─ Always build landing
   ├─ Always build docs
   └─ Always deploy
```

## Performance Timeline

```
┌─────────────────────────────────────────────────────────────┐
│              Typical Deployment Timeline                    │
└─────────────────────────────────────────────────────────────┘

Event Triggered
    │
    ├─ Setup (30s)
    │   ├─ Checkout code
    │   ├─ Setup Node.js
    │   └─ Setup pnpm
    │
    ├─ Install (60s)
    │   └─ Install dependencies (with cache)
    │
    ├─ Build (120s)
    │   ├─ Build landing (60s)
    │   ├─ Build docs (60s)
    │   └─ Prepare deploy directory (10s)
    │
    ├─ Upload (30s)
    │   └─ Upload artifact to GitHub Pages
    │
    └─ Deploy (30s)
        └─ Deploy to GitHub Pages

Total: ~4-5 minutes

With cache hit: ~2-3 minutes
```

## Related Documentation

- Workflow: `.github/workflows/deploy-landing.yml`
- Quick Start: `.github/DEPLOYMENT_QUICK_START.md`
- Detailed Guide: `.github/DEPLOYMENT_GUIDE.md`
- Structure: `.github/DEPLOYMENT_STRUCTURE.md`
