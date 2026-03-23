/**
 * Workspace env manifest for @edcalderon/versioning workspace-env extension.
 * Defines canonical variables and how they map to each package's .env.example / .env.local.
 */

/** @type {import('@edcalderon/versioning').WorkspaceEnvManifest} */
module.exports = {
  sources: ['.env', '.env.local'],
  rootExampleFile: '.env.example',

  variables: {
    // ── Internal services ──────────────────────────────────────────────────
    API_URL: {
      description: 'Internal API URL for agent packages',
      example: 'http://localhost:8080',
      targets: { agents: 'API_URL' },
    },
    CARTOGRAPHY_URL: {
      description: 'Cartography service URL',
      example: 'http://localhost:8001',
      targets: { api: 'CARTOGRAPHY_URL', discovery: 'CARTOGRAPHY_URL' },
    },
    CHROMA_URL: {
      description: 'Chroma vector database URL',
      example: 'http://localhost:8000',
      targets: { api: 'CHROMA_URL', agents: 'CHROMA_URL', chatbot: 'CHROMA_URL' },
    },
    CORS_ORIGINS: {
      description: 'Comma-separated allowed origins for the API',
      example: 'http://localhost:3000,http://localhost:3001',
      targets: { api: 'CORS_ORIGINS' },
    },
    HOST: {
      description: 'API host binding',
      example: '0.0.0.0',
      targets: { api: 'HOST' },
    },
    PORT: {
      description: 'API port',
      example: '8080',
      targets: { api: 'PORT' },
    },

    // ── Neo4j ──────────────────────────────────────────────────────────────
    NEO4J_URI: {
      description: 'Neo4j connection URI',
      example: 'bolt://localhost:7687',
      targets: { api: 'NEO4J_URI', graph: 'NEO4J_URI' },
    },
    NEO4J_USER: {
      description: 'Neo4j username',
      example: 'neo4j',
      targets: { api: 'NEO4J_USER', graph: 'NEO4J_USER' },
    },
    NEO4J_PASSWORD: {
      description: 'Neo4j password',
      example: 'neo4j',
      secret: true,
      targets: { api: 'NEO4J_PASSWORD', graph: 'NEO4J_PASSWORD' },
    },
    NEO4J_DATABASE: {
      description: 'Neo4j database name',
      example: 'neo4j',
      targets: { api: 'NEO4J_DATABASE', graph: 'NEO4J_DATABASE' },
    },

    // ── Auth / JWT ─────────────────────────────────────────────────────────
    JWT_SECRET: {
      description: 'JWT signing secret',
      example: '<YOUR_JWT_SECRET>',
      secret: true,
      targets: { api: 'JWT_SECRET' },
    },
    AUTHENTIK_TOKEN_ENDPOINT: {
      description: 'Authentik OIDC Token Endpoint',
      example: 'https://<YOUR_AUTHENTIK_DOMAIN>/application/o/token/',
      targets: { api: 'AUTHENTIK_TOKEN_ENDPOINT' },
    },
    AUTHENTIK_JWKS_URI: {
      description: 'Authentik OIDC JWKS Endpoint',
      example: 'https://<YOUR_AUTHENTIK_DOMAIN>/application/o/cig/jwks/',
      targets: { api: 'AUTHENTIK_JWKS_URI' },
    },
    OIDC_CLIENT_ID: {
      description: 'OIDC Client ID for Authentik',
      example: '<YOUR_CLIENT_ID>',
      targets: { api: 'OIDC_CLIENT_ID' },
    },
    OIDC_CLIENT_SECRET: {
      description: 'OIDC Client Secret for Authentik',
      example: '<YOUR_CLIENT_SECRET>',
      secret: true,
      targets: { api: 'OIDC_CLIENT_SECRET' },
    },
    OIDC_REDIRECT_URI: {
      description: 'OIDC Redirect URI for local callback',
      example: 'http://localhost:8080/api/v1/auth/oidc/callback',
      targets: { api: 'OIDC_REDIRECT_URI' },
    },

    // ── Supabase ───────────────────────────────────────────────────────────
    SUPABASE_URL: {
      description: 'Canonical Supabase URL for frontend consumers',
      example: 'https://<YOUR_PROJECT>.supabase.co',
      targets: {
        landing: 'NEXT_PUBLIC_SUPABASE_URL',
        dashboard: 'NEXT_PUBLIC_SUPABASE_URL',
      },
    },
    SUPABASE_ANON_KEY: {
      description: 'Canonical Supabase anon key for frontend consumers',
      example: '<YOUR_SUPABASE_ANON_KEY>',
      secret: true,
      targets: {
        landing: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        dashboard: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      },
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      description: 'Supabase service role key',
      example: '<YOUR_SUPABASE_SERVICE_ROLE_KEY>',
      secret: true,
      targets: {
        api: 'SUPABASE_SERVICE_ROLE_KEY',
        dashboard: 'SUPABASE_SERVICE_ROLE_KEY',
      },
    },
    SUPABASE_DIRECT_URL: {
      description: 'Direct database connection string',
      example: 'postgresql://postgres:postgres@localhost:5432/postgres',
      secret: true,
      targets: {},
    },
    SUPABASE_DIRECT_URL_MIGRATIONS: {
      description: 'Direct database connection string used for migrations',
      example: 'postgresql://postgres:postgres@localhost:5432/postgres',
      secret: true,
      targets: {},
    },

    // ── AI / LLM ───────────────────────────────────────────────────────────
    OPENAI_API_KEY: {
      description: 'OpenAI API key',
      example: '<YOUR_OPENAI_API_KEY>',
      secret: true,
      targets: { api: 'OPENAI_API_KEY', agents: 'OPENAI_API_KEY', chatbot: 'OPENAI_API_KEY' },
    },

    // ── Discovery ──────────────────────────────────────────────────────────
    DISCOVERY_INTERVAL_MINUTES: {
      description: 'Discovery interval in minutes',
      example: '5',
      targets: { api: 'DISCOVERY_INTERVAL_MINUTES', discovery: 'DISCOVERY_INTERVAL_MINUTES' },
    },
    DISCOVERY_INTERVAL_MS: {
      description: 'Discovery interval in milliseconds',
      example: '300000',
      targets: { api: 'DISCOVERY_INTERVAL_MS', discovery: 'DISCOVERY_INTERVAL_MS' },
    },

    // ── Logging ────────────────────────────────────────────────────────────
    LOG_LEVEL: {
      description: 'Application log level',
      example: 'info',
      targets: { api: 'LOG_LEVEL' },
    },
    LOG_TIMESTAMPS: {
      description: 'Whether structured logs include timestamps',
      example: 'true',
      targets: {},
    },

    // ── Frontend / Public URLs ─────────────────────────────────────────────
    NEXT_PUBLIC_SITE_URL: {
      description: 'Primary public site URL',
      example: 'https://cig.lat',
      targets: { landing: 'NEXT_PUBLIC_SITE_URL', dashboard: 'NEXT_PUBLIC_SITE_URL' },
    },
    NEXT_PUBLIC_LEGACY_SITE_URL: {
      description: 'Legacy public site URL',
      example: 'https://edwardcalderon.github.io/ComputeIntelligenceGraph',
      targets: { landing: 'NEXT_PUBLIC_LEGACY_SITE_URL' },
    },
    NEXT_PUBLIC_API_URL: {
      description: 'Public API URL for browser apps',
      example: 'http://localhost:8080',
      targets: { dashboard: 'NEXT_PUBLIC_API_URL' },
    },
    NEXT_PUBLIC_DASHBOARD_URL: {
      description: 'Dashboard URL — where to redirect after a successful sign-in',
      example: 'http://localhost:3001',
      targets: { landing: 'NEXT_PUBLIC_DASHBOARD_URL' },
    },
    LEGACY_BASEPATH: {
      description: 'Enable the legacy GitHub Pages base path',
      example: 'false',
      targets: { landing: 'LEGACY_BASEPATH' },
    },

    // ── AWS ────────────────────────────────────────────────────────────────
    AWS_ACCOUNT_ID: {
      description: 'AWS account ID',
      example: '123456789012',
      targets: {},
    },
    AWS_REGION: {
      description: 'AWS region',
      example: 'us-east-1',
      targets: {},
    },
    AWS_PROFILE: {
      description: 'AWS CLI profile',
      example: 'default',
      targets: {},
    },
    AWS_ROLE_ARN: {
      description: 'AWS role ARN',
      example: 'arn:aws:iam::123456789012:role/cig',
      targets: {},
    },

    // ── GCP ────────────────────────────────────────────────────────────────
    GCP_PROJECT: {
      description: 'GCP project ID',
      example: 'your-gcp-project',
      targets: {},
    },

    // ── Google OAuth ───────────────────────────────────────────────────────
    GOOGLE_AUTH_CLIENT_ID: {
      description: 'Google OAuth client ID',
      example: '<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com',
      targets: {},
    },
    GOOGLE_AUTH_CLIENT_SECRET: {
      description: 'Google OAuth client secret',
      example: '<YOUR_GOOGLE_CLIENT_SECRET>',
      secret: true,
      targets: {},
    },

    // ── Authentik ──────────────────────────────────────────────────────────
    AUTHENTIK_DOMAIN: {
      description: 'Authentik domain',
      example: '<YOUR_AUTHENTIK_DOMAIN>',
      targets: {},
    },
    AUTHENTIK_ADMIN_EMAIL: {
      description: 'Authentik admin email',
      example: '<YOUR_AUTHENTIK_ADMIN_EMAIL>',
      targets: {},
    },
    AUTHENTIK_TOKEN_ENDPOINT: {
      description: 'Authentik OIDC token endpoint',
      example: 'https://auth.example.com/application/o/token/',
      targets: { api: 'AUTHENTIK_TOKEN_ENDPOINT' },
    },
    AUTHENTIK_JWKS_URI: {
      description: 'Authentik JWKS endpoint for ID token signature verification',
      example: 'https://auth.example.com/application/o/cig/jwks/',
      targets: { api: 'AUTHENTIK_JWKS_URI' },
    },
    AUTHENTIK_ISSUER_URL: {
      description: 'Authentik OIDC issuer URL',
      example: 'https://auth.example.com/application/o/cig/',
      targets: { api: 'AUTHENTIK_ISSUER_URL' },
    },
    OIDC_CLIENT_ID: {
      description: 'OIDC client ID registered in Authentik',
      example: 'your-oidc-client-id',
      targets: { api: 'OIDC_CLIENT_ID' },
    },
    OIDC_CLIENT_SECRET: {
      description: 'OIDC client secret',
      example: 'your-oidc-client-secret',
      secret: true,
      targets: { api: 'OIDC_CLIENT_SECRET' },
    },
    OIDC_REDIRECT_URI: {
      description: 'OIDC redirect URI for the API callback',
      example: 'http://localhost:8080/api/v1/auth/oidc/callback',
      targets: { api: 'OIDC_REDIRECT_URI' },
    },
    AUTHENTIK_SUBNET_ID: {
      description: 'Authentik subnet ID',
      example: 'subnet-1234567890',
      targets: {},
    },
    AUTHENTIK_VPC_ID: {
      description: 'Authentik VPC ID',
      example: 'vpc-1234567890',
      targets: {},
    },

    // ── IaC ────────────────────────────────────────────────────────────────
    IAC_MODULES_PATH: {
      description: 'Terraform modules base path',
      example: './packages/iac/modules',
      targets: {},
    },
    IAC_COMPUTE_MODULE: {
      description: 'Compute module name',
      example: 'compute',
      targets: {},
    },
    IAC_NETWORKING_MODULE: {
      description: 'Networking module name',
      example: 'networking',
      targets: {},
    },

    // ── Dashboard config ───────────────────────────────────────────────────
    DASHBOARD_DOMAIN: {
      description: 'Dashboard domain',
      example: 'dashboard.example.com',
      targets: {},
    },
    DASHBOARD_BUILD_PATH: {
      description: 'Dashboard build output path',
      example: './apps/dashboard/out',
      targets: {},
    },
    DASHBOARD_AUTHENTIK_INTEGRATION: {
      description: 'Whether dashboard integrates with Authentik',
      example: 'true',
      targets: {},
    },
  },

  targets: {
    landing: {
      description: 'apps/landing Next.js app',
      path: 'apps/landing',
      envFile: '.env.local',
      exampleFile: '.env.example',
    },
    dashboard: {
      description: 'apps/dashboard Next.js app',
      path: 'apps/dashboard',
      envFile: '.env.local',
      exampleFile: '.env.example',
    },
    api: {
      description: 'packages/api Express server',
      path: 'packages/api',
      envFile: '.env',
      exampleFile: '.env.example',
    },
    agents: {
      description: 'packages/agents LangChain agents',
      path: 'packages/agents',
      envFile: '.env',
      exampleFile: '.env.example',
    },
    chatbot: {
      description: 'packages/chatbot RAG chatbot',
      path: 'packages/chatbot',
      envFile: '.env',
      exampleFile: '.env.example',
    },
    discovery: {
      description: 'packages/discovery asset discovery',
      path: 'packages/discovery',
      envFile: '.env',
      exampleFile: '.env.example',
    },
    graph: {
      description: 'packages/graph Neo4j graph layer',
      path: 'packages/graph',
      envFile: '.env',
      exampleFile: '.env.example',
    },
  },
};
