# Workflow UI Builder

A powerful visual workflow designer built with React and TypeScript. Create, edit, debug, and simulate workflow processes with an intuitive drag-and-drop interface.

## Features

### Core Workflow Design
- **13 Node Types**: Trigger, Webhook, Schedule, Task, HTTP Request, Email, Script, Transform, Decision, Parallel, Loop, Delay, End
- **Visual Node Editor**: Drag and drop nodes onto an infinite canvas
- **Connection Management**: Create connections between nodes with animated bezier curves
- **Multi-port Nodes**: Support for success/error output ports
- **Sticky Notes**: Add annotations and documentation to your workflows

### Advanced Features
- **Workflow Simulation**: Run workflows with real-time execution visualization
- **Debug Mode**: Set breakpoints, step through execution, inspect context
- **Watch Panel**: Monitor expressions during execution
- **Execution History**: View and replay past workflow runs
- **Call Stack**: Track nested execution flow
- **Flame Chart**: Visual performance analysis

### Data Management
- **Data Mapping**: Map data between nodes with visual field mapping UI
- **Transform Expressions**: Apply JavaScript transforms to data
- **Context Variables**: Access and modify execution context

### Persistence & Deployment
- **Auto-save**: Workflows automatically saved to localStorage
- **Import/Export**: Export workflows as JSON, import from files
- **Workflow Manager**: Create, duplicate, delete saved workflows
- **Docker Support**: Production-ready Docker configuration

### Productivity
- **Undo/Redo**: Full history management with Ctrl+Z/Y
- **Multi-select**: Select multiple nodes with box selection
- **Copy/Paste**: Duplicate node groups
- **Zoom & Pan**: Navigate large workflows with zoom controls
- **Minimap**: Overview navigation for large workflows
- **Keyboard Shortcuts**: Efficient workflow editing

## Node Types

| Node | Description | Output Ports |
|------|-------------|--------------|
| **Trigger** | Manual start event | 1 |
| **Webhook** | HTTP webhook trigger | 1 |
| **Schedule** | Cron-based trigger | 1 |
| **Task** | Generic action step | 2 (success/error) |
| **HTTP** | HTTP API requests | 2 (success/error) |
| **Email** | Send email messages | 2 (success/error) |
| **Script** | Execute JavaScript/Python | 2 (success/error) |
| **Transform** | Transform data | 1 |
| **Decision** | Conditional branching | 2 (true/false) |
| **Parallel** | Concurrent execution | 1 |
| **Loop** | Iteration control | 2 (body/exit) |
| **Delay** | Wait/sleep step | 1 |
| **End** | Workflow completion | 0 |

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view in browser.

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t workflow-designer .
docker run -p 3000:80 workflow-designer
```

### Docker Development (with hot reload)

```bash
docker-compose --profile dev up workflow-dev
```

## Available Scripts

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).

### `npm test`

Launches the test runner in interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy selected nodes |
| `Ctrl+V` | Paste nodes |
| `Delete` | Delete selected nodes |
| `Escape` | Cancel current operation |

## Project Structure

```
src/
├── components/
│   └── WorkflowDesigner/
│       ├── components/      # UI components
│       │   ├── Toolbar.tsx
│       │   ├── NodePalette.tsx
│       │   ├── WorkflowCanvas.tsx
│       │   ├── PropertiesPanel.tsx
│       │   ├── DebugPanel.tsx
│       │   ├── DataMappingPanel.tsx
│       │   └── WorkflowListPanel.tsx
│       ├── hooks/           # React hooks
│       ├── types.ts         # TypeScript definitions
│       ├── constants.ts     # Configuration
│       ├── utils.ts         # Utility functions
│       ├── workflowStorage.ts   # localStorage persistence
│       └── workflowExecutor.ts  # Execution engine
```

## Configuration

### HTTP Node
- Method: GET, POST, PUT, DELETE, PATCH
- URL with template variables: `https://api.example.com/{{userId}}`
- Headers as JSON
- Request body
- Timeout configuration

### Email Node
- To/From addresses
- Subject with template variables
- HTML/text body
- Template interpolation: `{{variable}}`

### Script Node
- JavaScript or Python execution
- Access context via `ctx` object
- Output variable assignment

### Schedule Node
- Cron expression support
- Preset schedules (every minute, hour, day, etc.)
- Timezone configuration

### Transform Node
- JavaScript expressions
- Data mapping
- Context merging

## License

MIT
