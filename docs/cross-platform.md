# Cross-Platform Support

## Supported Platforms

| Platform | Versions | Status |
|----------|----------|--------|
| Linux (Ubuntu) | 22.04 LTS, 24.04 LTS | Supported |
| Linux (Fedora) | 39, 40 | Supported |
| macOS (Intel) | 12 Monterey, 13 Ventura, 14 Sonoma | Supported |
| macOS (Apple Silicon) | 12 Monterey, 13 Ventura, 14 Sonoma | Supported |
| Windows 10/11 + WSL2 | 21H2+ | Supported |

## Docker Requirements

### Docker Desktop (macOS and Windows)
- Docker Desktop 4.x or later
- Enable WSL2 backend on Windows (recommended over Hyper-V)
- Allocate at least 4 GB RAM in Docker Desktop settings

### Docker Engine (Linux)
- Docker Engine 24.x or later
- Docker Compose v2 plugin (`docker compose` not `docker-compose`)
- User must be in the `docker` group: `sudo usermod -aG docker $USER`

## WSL2 Setup (Windows)

1. Enable WSL2: `wsl --install` (requires Windows 10 21H2+ or Windows 11)
2. Set WSL2 as default: `wsl --set-default-version 2`
3. Install a distro (e.g. Ubuntu): `wsl --install -d Ubuntu`
4. Install Docker Desktop and enable the WSL2 backend in Settings → Resources → WSL Integration
5. Run all `cig` commands from inside the WSL2 terminal

## Path Handling

- All internal paths use forward slashes (`/`) regardless of platform.
- The `normalizePath()` utility in `packages/cli/src/platform.ts` converts backslashes to forward slashes.
- UNC paths (`\\server\share`) are normalized to `//server/share`.
- The config directory is resolved per platform:
  - Linux/macOS: `~/.cig`
  - Windows: `%APPDATA%\cig`

## Line Endings

The `.gitattributes` file at the repo root enforces consistent line endings:
- All text files use LF (`eol=lf`) by default.
- `.bat`, `.cmd`, and `.ps1` files use CRLF as required by Windows tooling.
- Binary assets (images, fonts) are marked `binary` to prevent any conversion.

## Known Platform-Specific Issues

### macOS Apple Silicon (arm64)
- Some Docker images may not have native arm64 builds; Docker Desktop handles emulation via Rosetta 2.
- If a service fails to start, add `platform: linux/amd64` to the relevant service in `docker-compose.yml`.

### Windows (WSL2)
- File I/O on Windows-mounted paths (`/mnt/c/...`) is significantly slower than native WSL2 paths. Keep the project inside the WSL2 filesystem (e.g. `~/projects/cig`).
- Docker socket is available at `/var/run/docker.sock` inside WSL2 when Docker Desktop WSL integration is enabled.

### Linux
- Ensure `/var/run/docker.sock` is accessible to your user (see Docker group setup above).
- SELinux (Fedora/RHEL): volume mounts may require the `:z` or `:Z` flag, e.g. `- ./data:/data:z`.
