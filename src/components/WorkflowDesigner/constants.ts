import { NodeType, NodeTypeConfig, WorkflowNode, Connection, ExecutionContext } from './types';
import React from 'react';

export const NODE_WIDTH = 172;
export const NODE_HEIGHT = 58;

export const TYPES: Record<NodeType, NodeTypeConfig> = {
  trigger:  { color: '#10b981', label: 'Trigger',  outs: 1 },
  task:     { color: '#3b82f6', label: 'Task',     outs: 1 },
  decision: { color: '#f59e0b', label: 'Decision', outs: 2 },
  parallel: { color: '#a855f7', label: 'Parallel', outs: 1 },
  end:      { color: '#ef4444', label: 'End',      outs: 0 },
};

export const ICONS: Record<NodeType, string> = {
  trigger: '▶',
  task: '◉',
  decision: '◆',
  parallel: '⊞',
  end: '■',
};

export const DESCRIPTIONS: Record<NodeType, string> = {
  trigger: 'start event',
  task: 'action step',
  decision: 'if/else',
  parallel: 'concurrent',
  end: 'completion',
};

export const DEMO_NODES: WorkflowNode[] = [
  { id: 'n1', type: 'trigger',  label: 'Invoice Created',  x: 60,   y: 210, config: { triggerType: 'API Call' } },
  { id: 'n2', type: 'task',     label: 'Validate Invoice', x: 295,  y: 210, config: { actionType: 'Call API', endpoint: '/api/validate' } },
  { id: 'n3', type: 'decision', label: 'Amount > $10k?',   x: 530,  y: 210, config: { condition: 'amount > 10000' } },
  { id: 'n4', type: 'task',     label: 'Manager Approval', x: 765,  y: 105, config: { actionType: 'Send Email', endpoint: 'manager@corp.com' } },
  { id: 'n5', type: 'task',     label: 'Auto Approve',     x: 765,  y: 325, config: { actionType: 'Create Record', endpoint: '/api/approve' } },
  { id: 'n6', type: 'task',     label: 'Post to Ledger',   x: 1000, y: 210, config: { actionType: 'Call API', endpoint: '/api/ledger' } },
  { id: 'n7', type: 'end',      label: 'Complete',         x: 1220, y: 210, config: {} },
];

export const DEMO_CONNECTIONS: Connection[] = [
  { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
  { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
  { id: 'c3', from: 'n3', to: 'n4', port: 0, label: 'Yes' },
  { id: 'c4', from: 'n3', to: 'n5', port: 1, label: 'No' },
  { id: 'c5', from: 'n4', to: 'n6', port: 0, label: '' },
  { id: 'c6', from: 'n5', to: 'n6', port: 0, label: '' },
  { id: 'c7', from: 'n6', to: 'n7', port: 0, label: '' },
];

export const INITIAL_CONTEXT: ExecutionContext = {
  invoice_id: 'INV-2024-0847',
  amount: 14500,
  currency: 'USD',
  vendor: 'Acme Corp',
  submitted_by: 'alice@corp.com',
  timestamp: '2024-03-13T09:22:00Z',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: '#484f58',
  running: '#22d3ee',
  done: '#10b981',
  error: '#f85149',
  paused: '#f59e0b',
};

export const LOG_COLORS: Record<string, string> = {
  info: '#8b949e',
  success: '#10b981',
  warn: '#f59e0b',
  error: '#f85149',
  breakpoint: '#f59e0b',
};

export const LOG_ICONS: Record<string, string> = {
  info: '·',
  success: '✓',
  warn: '⚠',
  error: '✕',
  breakpoint: '⬡',
};

export const BUTTON_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #30363d',
  color: '#8b949e',
  padding: '4px 11px',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
};

export const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: '#0d1117',
  border: '1px solid #30363d',
  color: '#e6edf3',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'monospace',
  boxSizing: 'border-box',
  outline: 'none',
};

export const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  padding: '4px 6px',
};

export const TRIGGER_TYPES = ['API Call', 'Webhook', 'Timer', 'User Action', 'DB Event'];
export const ACTION_TYPES = ['Send Email', 'Call API', 'Create Record', 'Generate Report', 'Send Notification', 'Log Audit'];
