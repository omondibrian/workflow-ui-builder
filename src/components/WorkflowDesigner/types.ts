export type NodeType = 'trigger' | 'task' | 'decision' | 'parallel' | 'end';

export type SimStatus = 'idle' | 'pending' | 'running' | 'done' | 'paused' | 'error';

export type SimState = 'idle' | 'running' | 'paused' | 'done' | 'error';

export interface NodeConfig {
  triggerType?: string;
  actionType?: string;
  endpoint?: string;
  condition?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: NodeConfig;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  port: number;
  label: string;
}

export interface NodeTypeConfig {
  color: string;
  label: string;
  outs: number;
}

export interface Point {
  x: number;
  y: number;
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
  [key: string]: string | number | boolean | undefined;
}

export interface WorkflowData {
  workflow: string;
  version: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  lastContext: ExecutionContext;
}
