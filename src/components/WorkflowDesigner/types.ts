export type NodeType = 
  | 'trigger' 
  | 'task' 
  | 'decision' 
  | 'parallel' 
  | 'end' 
  | 'loop' 
  | 'delay'
  | 'http'      // HTTP Request
  | 'email'     // Send Email
  | 'script'    // Execute Code
  | 'transform' // Data Transform
  | 'webhook'   // Webhook Trigger
  | 'schedule'; // Scheduled Trigger

export type SimStatus = 'idle' | 'pending' | 'running' | 'done' | 'paused' | 'error';

export type SimState = 'idle' | 'running' | 'paused' | 'done' | 'error';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpHeader {
  key: string;
  value: string;
}

export interface NodeConfig {
  // Trigger
  triggerType?: string;
  triggerEnabled?: boolean;
  triggerDescription?: string;
  inputSchema?: string;
  maxConcurrent?: number;
  // Task (legacy)
  actionType?: string;
  endpoint?: string;
  taskDescription?: string;
  taskTimeout?: number;
  taskRetryStrategy?: string;
  taskMaxRetries?: number;
  taskOutputVariable?: string;
  // Decision
  condition?: string;
  decisionMode?: string;
  switchVariable?: string;
  defaultBranch?: string;
  caseSensitive?: boolean;
  // Loop
  loopCount?: number;
  exitCondition?: string;
  loopIterator?: string;
  loopBatchSize?: number;
  loopItemVariable?: string;
  loopIndexVariable?: string;
  loopContinueOnError?: boolean;
  // Delay
  delayMs?: number;
  delayValue?: number;
  delayUnit?: string;
  delayDescription?: string;
  delayInterruptible?: boolean;
  // HTTP Request
  httpMethod?: HttpMethod;
  httpUrl?: string;
  httpHeaders?: HttpHeader[];
  httpBody?: string;
  httpTimeout?: number;
  httpAuthType?: string;
  httpBearerToken?: string;
  httpUsername?: string;
  httpPassword?: string;
  httpApiKeyHeader?: string;
  httpApiKeyValue?: string;
  httpContentType?: string;
  httpRetryStrategy?: string;
  httpMaxRetries?: number;
  httpRetryDelay?: number;
  httpFollowRedirects?: boolean;
  httpValidateSSL?: boolean;
  // Email
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string;
  emailCc?: string;
  emailBcc?: string;
  emailIsHtml?: boolean;
  emailReplyTo?: string;
  emailPriority?: string;
  emailAttachments?: string;
  // Script
  scriptLanguage?: 'javascript' | 'python';
  scriptCode?: string;
  scriptTimeout?: number;
  scriptErrorHandling?: string;
  scriptAsync?: boolean;
  // Transform
  transformExpression?: string;
  transformMapping?: Record<string, string>;
  transformErrorHandling?: string;
  transformValidateOutput?: boolean;
  transformOutputSchema?: string;
  // Webhook
  webhookPath?: string;
  webhookMethod?: HttpMethod;
  webhookSecret?: string;
  webhookAuthType?: string;
  webhookResponseStatus?: number;
  webhookResponseBody?: string;
  webhookAsync?: boolean;
  // Schedule
  cronExpression?: string;
  timezone?: string;
  scheduleEnabled?: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleDescription?: string;
  // Parallel
  parallelMaxConcurrency?: number;
  parallelTimeout?: number;
  parallelFailFast?: boolean;
  parallelWaitAll?: boolean;
  parallelMergeStrategy?: string;
  // End
  endStatus?: string;
  endStatusVariable?: string;
  endOutputMapping?: string;
  endMessage?: string;
  endNotify?: boolean;
  // Input/Output mapping
  inputMapping?: Record<string, string>;
  outputVariable?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: NodeConfig;
}

export interface DataMapping {
  sourceField: string;
  targetField: string;
  transform?: string; // Optional JS expression
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  port: number;
  label: string;
  isError?: boolean;
  mappings?: DataMapping[]; // Data mappings between nodes
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
}

export interface NodeTypeConfig {
  color: string;
  label: string;
  outs: number;
  errorPort?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragState {
  id: string;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

export interface PanState {
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

export interface ConnState {
  fromId: string;
  port: number;
  sp: Point;
}

export interface NodeStatus {
  status: SimStatus;
  duration?: number;
}

export interface LogEntry {
  id: string;
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'breakpoint';
  msg: string;
  nodeId: string | null;
}

export interface StackFrame {
  id: string;
  label: string;
  type: NodeType;
  entered?: string;
  start?: number;
}

export interface ExecutionContext {
  [key: string]: unknown;
}

// Secret stored in the workflow (value is masked in UI, resolved at runtime)
export interface WorkflowSecret {
  id: string;
  name: string;        // e.g., "API_KEY", "DATABASE_URL"
  value: string;       // The actual secret value (stored encrypted in production)
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowData {
  workflow: string;
  version: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  stickyNotes?: StickyNote[];
  secrets?: WorkflowSecret[];
  lastContext: ExecutionContext;
}

// Undo/Redo
export interface HistoryState {
  nodes: WorkflowNode[];
  connections: Connection[];
  stickyNotes: StickyNote[];
}

// Conditional breakpoints
export interface Breakpoint {
  nodeId: string;
  condition?: string;
  enabled: boolean;
}

// Watch items
export interface WatchItem {
  id: string;
  expression: string;
  pinned: boolean;
}

// Execution history
export interface ExecutionRun {
  id: string;
  timestamp: string;
  startedAt: string;
  workflowName: string;
  status: 'success' | 'error' | 'cancelled';
  duration: number;
  nodesExecuted: number;
  log: LogEntry[];
  context: ExecutionContext;
  nodePerf: Record<string, number>;
}

// Lint issues
export type LintSeverity = 'error' | 'warning';
export interface LintIssue {
  id: string;
  severity: LintSeverity;
  message: string;
  nodeId?: string;
}
