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
  // Task (legacy)
  actionType?: string;
  endpoint?: string;
  // Decision
  condition?: string;
  // Loop
  loopCount?: number;
  exitCondition?: string;
  // Delay
  delayMs?: number;
  // HTTP Request
  httpMethod?: HttpMethod;
  httpUrl?: string;
  httpHeaders?: HttpHeader[];
  httpBody?: string;
  httpTimeout?: number;
  // Email
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string;
  // Script
  scriptLanguage?: 'javascript' | 'python';
  scriptCode?: string;
  // Transform
  transformExpression?: string;
  transformMapping?: Record<string, string>;
  // Webhook
  webhookPath?: string;
  webhookMethod?: HttpMethod;
  webhookSecret?: string;
  // Schedule
  cronExpression?: string;
  timezone?: string;
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
  entered: string;
}

export interface ExecutionContext {
  [key: string]: unknown;
}

export interface WorkflowData {
  workflow: string;
  version: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  stickyNotes?: StickyNote[];
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
