# Dashboard → app.cig.lat — GCP Cloud Run Deployment

## Overview

The CIG Dashboard (`apps/dashboard`) is deployed as a containerised Next.js application on **Google Cloud Run**, served at **`app.cig.lat`** via a Cloud DNS custom-domain mapping.

```
User → app.cig.lat
         ↓  (Cloud DNS CNAME → ghs.googlehosted.com)
       Cloud Run custom domain
         ↓  (HTTPS, managed TLS)
       Cloud Run service  (us-central1)
         ↓  (container port 3000)
       Next.js 14 dashboard
         ↓  (NEXT_PUBLIC_API_URL)
       CIG API  (separate host / Cloud Run)
```

---

## GCP Project

| Item | Value |
|---|---|
| Project ID | `cig-technology` |
| Project number | `469673226548` |
| Region | `us-central1` |
| DNS zone | `cig-lat` → `cig.lat.` |
| Dashboard URL | `https://app.cig.lat` |
| Service account | `cig-lat@cig-technology.iam.gserviceaccount.com` |

---

## Architecture Decision: Cloud Run vs Alternatives

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Cloud Run** ✅ | Serverless, pay-per-request, managed HTTPS, custom domains, fast deploys, no infra ops | Cold starts (~300 ms), no persistent storage | **Best fit** for Next.js dashboard |
| GCE VM (Terraform module) | Full control, persistent processes | Ops overhead, always-on cost | Overkill for a UI |
| GKE | Scales, multi-service | Expensive, complex for one service | Future if stack grows |
| Firebase Hosting | Zero-config static | No SSR, no server components | Next.js needs a server |

Cloud Run is the right choice because:
- Dashboard is stateless (all state in Supabase/sessionStorage)
- Next.js 14 `standalone` output produces a single `server.js` entry — maps perfectly to a container
- Custom-domain TLS is managed automatically
- Zero ops between deployments

---

## One-Time GCP Setup

These steps must be done **once** by an account with Owner/Editor on `cig-technology`.

```bash
# Activate credentials
source .env.gcloud
gcloud auth activate-service-account \
  --key-file=config/env/private-gcloud.json

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  domains.googleapis.com \
  --project=cig-technology

# Create Artifact Registry repository (stores container images)
gcloud artifacts repositories create cig \
  --repository-format=docker \
  --location=us-central1 \
  --description="CIG container images" \
  --project=cig-technology

# Grant the service account the roles it needs
SA="cig-lat@cig-technology.iam.gserviceaccount.com"
PROJECT="cig-technology"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountUser"

# Allow Cloud Run to be invoked publicly (unauthenticated)
# (Auth is handled by Supabase JWT inside the app)
gcloud run services add-iam-policy-binding dashboard \
  --region=us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=cig-technology
```

### DNS: add app.cig.lat record

After the first Cloud Run deploy, GCP provides a CNAME target (e.g. `ghs.googlehosted.com`).

```bash
gcloud dns record-sets create app.cig.lat. \
  --zone=cig-lat \
  --type=CNAME \
  --ttl=300 \
  --rrdatas="ghs.googlehosted.com." \
  --project=cig-technology
```

Then verify domain ownership via Cloud Run:

```bash
gcloud run domain-mappings create \
  --service=dashboard \
  --domain=app.cig.lat \
  --region=us-central1 \
  --project=cig-technology
```

---

## GitHub Actions Secrets Required

Add these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `GCP_SA_KEY` | Full JSON content of `config/env/private-gcloud.json` |
| `GCP_PROJECT_ID` | `cig-technology` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Production API URL (e.g. `https://api.cig.lat`) |
| `NEXT_PUBLIC_SITE_URL` | `https://cig.lat` |

---

## Container Image

**Registry:** `us-central1-docker.pkg.dev/cig-technology/cig/dashboard`

**Dockerfile:** `infra/docker/Dockerfile.dashboard`

The build uses Next.js [standalone output](https://nextjs.org/docs/pages/api-reference/next-config-js/output#automatically-copying-traced-files):
- Build produces `apps/dashboard/.next/standalone/` with a self-contained `server.js`
- Final image is ~150 MB (node:20-alpine, non-root user 1000)
- Port 3000, health check on `/`

The dashboard `next.config.js` must have `output: 'standalone'` for this to work.

---

## Cloud Run Service Configuration

```yaml
# Equivalent gcloud deploy command (automated by CI/CD)
gcloud run deploy dashboard \
  --image=us-central1-docker.pkg.dev/cig-technology/cig/dashboard:$TAG \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=5 \
  --concurrency=80 \
  --timeout=30s \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_SITE_URL=https://cig.lat" \
  --project=cig-technology
```

### Scaling policy

| Setting | Value | Rationale |
|---|---|---|
| `min-instances` | `0` | Cold start acceptable for a dashboard; saves cost |
| `max-instances` | `5` | Prevents runaway billing |
| `cpu` | `1` | Next.js SSR is CPU-bound at startup |
| `memory` | `512Mi` | Node.js + Next.js standalone fits comfortably |
| `concurrency` | `80` | Default; Next.js handles concurrent requests well |

---

## CI/CD Pipeline

The pipeline lives at `.github/workflows/deploy-dashboard.yml` and triggers on:
- Push to `main` (continuous deployment)
- Semver tags `v*.*.*` (release deployments)

### Flow

```
git push / tag
      ↓
  [CI] test.yml
      ↓ (parallel)
  [CD] deploy-dashboard.yml
      ├─ Build Next.js  (pnpm build)
      ├─ Docker build   (Dockerfile.dashboard)
      ├─ Push to Artifact Registry
      └─ gcloud run deploy
```

See `.github/workflows/deploy-dashboard.yml` for the full workflow.

---

## Local Deployment (Manual)

To deploy manually from your local machine:

```bash
# 1. Activate credentials
source .env.gcloud
gcloud auth activate-service-account \
  --key-file=config/env/private-gcloud.json

# 2. Configure Docker to use Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# 3. Build image
docker build \
  -f infra/docker/Dockerfile.dashboard \
  -t us-central1-docker.pkg.dev/cig-technology/cig/dashboard:manual \
  .

# 4. Push
docker push us-central1-docker.pkg.dev/cig-technology/cig/dashboard:manual

# 5. Deploy
gcloud run deploy dashboard \
  --image=us-central1-docker.pkg.dev/cig-technology/cig/dashboard:manual \
  --region=us-central1 \
  --allow-unauthenticated \
  --project=cig-technology
```

---

## Environment Variables in Production

`NEXT_PUBLIC_*` vars are **baked into the JS bundle at build time**. They must be passed as Docker build args, not Cloud Run env vars.

The CI workflow passes them via `--build-arg` during `docker build`:

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.cig.lat \
  --build-arg NEXT_PUBLIC_SITE_URL=https://cig.lat \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -f infra/docker/Dockerfile.dashboard \
  -t ... .
```

Runtime-only variables (no `NEXT_PUBLIC_` prefix) are safe to pass via Cloud Run env vars.

---

## Monitoring & Logs

```bash
# Tail live logs
gcloud logging tail \
  "resource.type=cloud_run_revision AND resource.labels.service_name=dashboard" \
  --project=cig-technology

# View recent logs
gcloud run services logs read dashboard \
  --region=us-central1 \
  --project=cig-technology \
  --limit=50

# Describe current service state
gcloud run services describe dashboard \
  --region=us-central1 \
  --project=cig-technology
```

---

## Rollback

```bash
# List recent revisions
gcloud run revisions list \
  --service=dashboard \
  --region=us-central1 \
  --project=cig-technology

# Rollback to a specific revision
gcloud run services update-traffic dashboard \
  --to-revisions=dashboard-XXXXX=100 \
  --region=us-central1 \
  --project=cig-technology
```

---

## Cost Estimate

Cloud Run pricing (us-central1, as of 2025):

| Resource | Free tier | Price |
|---|---|---|
| CPU | 180,000 vCPU-seconds/month | $0.00002400/vCPU-second |
| Memory | 360,000 GB-seconds/month | $0.00000250/GB-second |
| Requests | 2M requests/month | $0.40/million |

**Expected cost for low-traffic dashboard:** ~$0–$3/month within free tier.

---

## Related Files

| File | Purpose |
|---|---|
| `infra/docker/Dockerfile.dashboard` | Container build definition |
| `apps/dashboard/next.config.js` | Next.js build config (must have `output: standalone`) |
| `.github/workflows/deploy-dashboard.yml` | CI/CD pipeline |
| `.github/workflows/publish.yml` | Existing GHCR image publish (kept for dev) |
| `.env.gcloud` | Local GCP credential env vars |
| `set-gcloud-project.sh` | Script to activate GCP session locally |
| `packages/iac/modules/gcp/main.tf` | Terraform for GCE VM (legacy / alternative) |
