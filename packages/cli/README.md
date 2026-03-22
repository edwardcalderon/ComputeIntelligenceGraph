# @cig-technology/cli

Production-oriented CLI for Compute Intelligence Graph.

## Install

```bash
npm install -g @cig-technology/cli
```

Or run it directly:

```bash
npx @cig-technology/cli login
```

## Core commands

```bash
cig login
cig install --mode self-hosted
cig install --mode managed
cig enroll
cig connect aws --role-arn arn:aws:iam::123456789012:role/CIGDiscovery
cig connect gcp --service-account ./service-account.json
cig connect api --url https://app.cig.lat
cig permissions
cig status
cig open
cig upgrade
cig uninstall
```

## Release

Create a tag in the form `cli-vx.y.z` to trigger the npm publish workflow, or run:

```bash
pnpm cli:release:patch
pnpm cli:release:minor
pnpm cli:release:major
```
