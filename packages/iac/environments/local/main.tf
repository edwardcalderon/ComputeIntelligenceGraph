# Local environment — no cloud infrastructure needed.
# CIG runs entirely via Docker Compose on your local machine.
#
# Prerequisites:
#   - Docker Desktop or Docker Engine installed
#   - Docker Compose v2 (included with Docker Desktop)
#
# To start CIG locally:
#
#   docker compose up -d
#
# Services exposed:
#   - Dashboard:    http://localhost:3000
#   - API:          http://localhost:8080
#   - Neo4j Browser: http://localhost:7474  (user: neo4j / pass: cigpassword)
#   - Neo4j Bolt:   bolt://localhost:7687
#
# To stop:
#
#   docker compose down
#
# To reset all data:
#
#   docker compose down -v
#
# See docker-compose.yml at the repo root for the full service definition.
