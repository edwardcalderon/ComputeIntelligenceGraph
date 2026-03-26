# Local Development Environment

This document describes the local development environment setup for the CIG Documentation system.

## Quick Start

### Start Development Server

To start the documentation development server at `http://localhost:3004`:

```bash
# From the monorepo root
pnpm dev:docs

# Or from the docs directory
cd apps/docs
pnpm dev
```

The development server will be available at `http://localhost:3004` with hot module reloading (HMR) enabled.

### Start All Services

To start all services including the docs at port 3004:

```bash
pnpm dev:all
```

This will start:
- Dashboard at http://localhost:3001
- Landing at http://localhost:3000
- Wizard UI at http://localhost:3002
- API at http://localhost:3003
- Docs at http://localhost:3004
- Plus other services (agents, chatbot, CLI, config, discovery, graph, SDK)

## Development Features

### 1. Hot Module Reloading (HMR)

The development server supports HMR for instant preview updates:

- **Component Changes**: Changes to React components are reflected immediately
- **Markdown Changes**: Changes to documentation markdown files trigger live reload
- **CSS Changes**: Style changes are applied without full page reload
- **Configuration Changes**: Some configuration changes may require manual refresh

### 2. Live Reload for Markdown

When you modify markdown files in the `docs/` directory, the development server automatically reloads the page:

```bash
# Edit a markdown file
vim docs/getting-started/index.md

# The browser will automatically reload to show your changes
```

### 3. Build Error Display

Build errors are displayed in the browser console and in an error overlay:

- **Error Overlay**: A visual overlay appears in the browser showing build errors
- **Console Logging**: Detailed error messages are logged to the browser console
- **Source Maps**: Source maps are enabled for easier debugging

### 4. Browser DevTools Support

Full browser DevTools support is enabled:

- **React DevTools**: Use React DevTools extension to inspect components
- **Source Maps**: Debug TypeScript/TSX files directly in DevTools
- **Console**: Full console access for logging and debugging
- **Network Tab**: Monitor network requests and responses

### 5. Development Tools Panel

A development tools panel is available in the bottom-right corner of the page (only in development mode):

#### i18n Language Switching
- Test language switching locally
- Supported languages: en, es, pt, fr, de, zh, ja
- Language preference is stored in localStorage

#### Mermaid Diagram Testing
- Test Mermaid diagram rendering
- Validate diagram syntax
- Supported diagram types: flowchart, sequence, class, state, er, gantt, pie, git

#### Search Functionality Testing
- Test search queries locally
- Mock search results
- Verify search index generation

#### Mock Analytics
- Track events locally
- View analytics logs in browser console
- Test analytics integration without external services

### 6. Error Boundaries

Error boundaries are configured to catch and display errors gracefully:

- **Component Errors**: Errors in React components are caught and displayed
- **Error Details**: Full error stack traces are shown in development mode
- **Console Logging**: Errors are logged to the browser console for debugging

## Configuration

### Port Configuration

The development server port is configured via the `PORT` environment variable:

```bash
# Start on port 3004 (default for docs)
PORT=3004 pnpm dev

# Start on a different port
PORT=3005 pnpm dev
```

### Environment Variables

Create a `.env.local` file in the `apps/docs` directory for local configuration:

```env
# Development environment
NODE_ENV=development

# Port configuration
PORT=3004

# Enable debug logging
DEBUG=*

# Analytics (mock in development)
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

## Debugging

### Browser Console

Open the browser console (F12 or Cmd+Option+I) to see:

- Build errors and warnings
- Development tool logs (prefixed with `[DevTools]`, `[Analytics]`, `[i18n]`, `[Mermaid]`, `[Search]`)
- React warnings and errors
- Custom application logs

### React DevTools

Install the React DevTools browser extension to:

- Inspect React component hierarchy
- View component props and state
- Profile component performance
- Track component updates

### Source Maps

Source maps are enabled for debugging TypeScript/TSX files:

1. Open DevTools (F12)
2. Go to the Sources tab
3. Navigate to `webpack://` → `src/`
4. Set breakpoints and debug TypeScript directly

### Development Tools Panel

Click the ⚙️ button in the bottom-right corner to open the development tools panel:

- **i18n Tab**: Test language switching
- **Mermaid Tab**: Test diagram rendering
- **Search Tab**: Test search functionality
- **Analytics Tab**: Test analytics tracking

## Common Tasks

### Add a New Documentation Page

1. Create a new markdown file in `docs/` directory:
   ```bash
   touch docs/my-new-page.md
   ```

2. Add frontmatter and content:
   ```markdown
   ---
   id: my-new-page
   title: My New Page
   description: Description of my new page
   sidebar_position: 5
   ---

   # My New Page

   Content goes here...
   ```

3. The page will automatically appear in the sidebar and be accessible at `/docs/my-new-page`

### Test Mermaid Diagrams

1. Add a Mermaid code block to your markdown:
   ```markdown
   ```mermaid
   graph TD
     A[Start] --> B[Process]
     B --> C[End]
   ```
   ```

2. The diagram will render automatically
3. Use the Development Tools Panel to test diagram rendering

### Test Language Switching

1. Open the Development Tools Panel (⚙️ button)
2. Go to the i18n tab
3. Click on a language button to switch
4. The page will update to reflect the language change
5. Language preference is stored in localStorage

### Test Search

1. Open the Development Tools Panel (⚙️ button)
2. Go to the Search tab
3. Enter a search query
4. Click "Test Search" to see mock results
5. Results are ranked by relevance

## Troubleshooting

### Port Already in Use

If port 3004 is already in use:

```bash
# Find the process using the port
lsof -ti :3004

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3005 pnpm dev
```

### Changes Not Reflecting

If your changes aren't showing up:

1. Check the browser console for errors
2. Try a hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. Clear the `.docusaurus` cache:
   ```bash
   pnpm clear
   ```
4. Restart the development server

### Build Errors

If you see build errors:

1. Check the error message in the browser console
2. Check the terminal output for detailed error information
3. Verify your markdown syntax is correct
4. Check for missing frontmatter in markdown files

### HMR Not Working

If hot module reloading isn't working:

1. Check that the development server is running
2. Verify the port is correct (should be 3004)
3. Check browser console for WebSocket errors
4. Try restarting the development server

## Performance Tips

- Use the Development Tools Panel to test features without affecting the main page
- Keep the browser console closed when not debugging (it can impact performance)
- Use React DevTools Profiler to identify performance bottlenecks
- Monitor network requests in the Network tab

## Next Steps

- Read the [Architecture Documentation](./docs/architecture/index.md)
- Check the [Contributing Guidelines](./docs/developer-guide/contributing.md)
- Review the [API Reference](./docs/api-reference/index.md)
