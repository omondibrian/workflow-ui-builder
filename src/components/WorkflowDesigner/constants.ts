import { NodeType, NodeTypeConfig, WorkflowNode, Connection, ExecutionContext } from './types';
import React from 'react';

export const NODE_WIDTH = 172;
export const NODE_HEIGHT = 58;

export const TYPES: Record<NodeType, NodeTypeConfig> = {
  trigger:   { color: '#10b981', label: 'Trigger',   outs: 1 },
  webhook:   { color: '#059669', label: 'Webhook',   outs: 1 },
  schedule:  { color: '#14b8a6', label: 'Schedule',  outs: 1 },
  task:      { color: '#3b82f6', label: 'Task',      outs: 2, errorPort: true },
  http:      { color: '#6366f1', label: 'HTTP',      outs: 2, errorPort: true },
  email:     { color: '#ec4899', label: 'Email',     outs: 2, errorPort: true },
  script:    { color: '#8b5cf6', label: 'Script',    outs: 2, errorPort: true },
  transform: { color: '#06b6d4', label: 'Transform', outs: 1 },
  decision:  { color: '#f59e0b', label: 'Decision',  outs: 2 },
  parallel:  { color: '#a855f7', label: 'Parallel',  outs: 1 },
  loop:      { color: '#22d3ee', label: 'Loop',      outs: 2 },
  delay:     { color: '#c084fc', label: 'Delay',     outs: 1 },
  end:       { color: '#ef4444', label: 'End',       outs: 0 },
};

export const ICONS: Record<NodeType, string> = {
  trigger: '▶',
  webhook: '⚡',
  schedule: '🕐',
  task: '◉',
  http: '🌐',
  email: '✉',
  script: '{ }',
  transform: '⇄',
  decision: '◆',
  parallel: '⊞',
  loop: '↺',
  delay: '⏱',
  end: '■',
};

export const DESCRIPTIONS: Record<NodeType, string> = {
  trigger: 'start event',
  webhook: 'HTTP trigger',
  schedule: 'cron job',
  task: 'action step',
  http: 'API request',
  email: 'send email',
  script: 'run code',
  transform: 'map data',
  decision: 'if/else',
  parallel: 'concurrent',
  loop: 'iterate',
  delay: 'wait time',
  end: 'completion',
};

// Real-world workflow: User Activity Analysis Pipeline
// Fetches data from public APIs and processes it through various node types
export const DEMO_NODES: WorkflowNode[] = [
  // Entry point - scheduled job
  { 
    id: 'n1', 
    type: 'schedule',  
    label: 'Daily User Sync',  
    x: 60,   
    y: 250, 
    config: { 
      cronExpression: '0 9 * * *',
      timezone: 'UTC'
    } 
  },
  
  // Fetch users from JSONPlaceholder API
  { 
    id: 'n2', 
    type: 'http',     
    label: 'Fetch Users',
    x: 260,  
    y: 250, 
    config: { 
      httpMethod: 'GET',
      httpUrl: 'https://jsonplaceholder.typicode.com/users',
      httpTimeout: 10000
    } 
  },
  
  // Transform the user data
  { 
    id: 'n3', 
    type: 'transform', 
    label: 'Extract User Info',   
    x: 460,  
    y: 250, 
    config: { 
      transformExpression: `{
  users: ctx.response?.body || [],
  totalUsers: (ctx.response?.body || []).length,
  processedAt: new Date().toISOString()
}`,
      outputVariable: 'userData'
    } 
  },
  
  // Check if we have users to process
  { 
    id: 'n4', 
    type: 'decision', 
    label: 'Has Users?',
    x: 660,  
    y: 250, 
    config: { 
      condition: 'totalUsers > 0'
    } 
  },

  // Loop through users
  { 
    id: 'n5', 
    type: 'loop',     
    label: 'Process Each User',
    x: 860,  
    y: 160, 
    config: { 
      loopCount: 5,
      exitCondition: 'currentIndex >= totalUsers'
    } 
  },
  
  // Fetch posts for current user
  { 
    id: 'n6', 
    type: 'http',     
    label: 'Fetch User Posts',
    x: 1100,  
    y: 80, 
    config: { 
      httpMethod: 'GET',
      httpUrl: 'https://jsonplaceholder.typicode.com/posts?userId={{currentUserId}}',
      httpTimeout: 5000
    } 
  },
  
  // Script to analyze post data
  { 
    id: 'n7', 
    type: 'script',   
    label: 'Analyze Activity',
    x: 1340,  
    y: 80, 
    config: { 
      scriptLanguage: 'javascript',
      scriptCode: `const posts = ctx.response?.body || [];
const postCount = posts.length;
const avgTitleLength = posts.reduce((sum, p) => sum + p.title.length, 0) / (postCount || 1);
return {
  userId: ctx.currentUserId,
  postCount,
  avgTitleLength: Math.round(avgTitleLength),
  isActive: postCount > 5,
  analyzedAt: new Date().toISOString()
};`,
      outputVariable: 'userAnalysis'
    } 
  },
  
  // Decision based on user activity
  { 
    id: 'n8', 
    type: 'decision', 
    label: 'Is Active User?',
    x: 1580,  
    y: 80, 
    config: { 
      condition: 'userAnalysis.isActive === true'
    } 
  },
  
  // Email for active users
  { 
    id: 'n9', 
    type: 'email',    
    label: 'Send Activity Report',
    x: 1820,  
    y: 0, 
    config: { 
      emailTo: 'admin@example.com',
      emailSubject: 'Active User Report: User {{currentUserId}}',
      emailBody: `User {{currentUserId}} has {{userAnalysis.postCount}} posts.
Average title length: {{userAnalysis.avgTitleLength}} characters.
Analysis completed at: {{userAnalysis.analyzedAt}}`,
      emailFrom: 'workflow@example.com'
    } 
  },
  
  // Transform for inactive users - just log
  { 
    id: 'n10', 
    type: 'transform', 
    label: 'Log Inactive',
    x: 1820,  
    y: 160, 
    config: { 
      transformExpression: `{
  skippedUsers: (ctx.skippedUsers || []).concat({
    userId: ctx.currentUserId,
    postCount: ctx.userAnalysis?.postCount || 0
  })
}`,
      outputVariable: 'inactiveLog'
    } 
  },
  
  // Delay for rate limiting
  { 
    id: 'n11', 
    type: 'delay',    
    label: 'Rate Limit (500ms)',
    x: 2060,  
    y: 80, 
    config: { 
      delayMs: 500
    } 
  },
  
  // Parallel processing placeholder
  { 
    id: 'n12', 
    type: 'parallel', 
    label: 'Merge Results',
    x: 1100,  
    y: 250, 
    config: {} 
  },
  
  // Final HTTP call - post summary to webhook
  { 
    id: 'n13', 
    type: 'http',     
    label: 'Post Summary',
    x: 1340,  
    y: 250, 
    config: { 
      httpMethod: 'POST',
      httpUrl: 'https://jsonplaceholder.typicode.com/posts',
      httpBody: `{
  "title": "Daily User Sync Report",
  "body": "Processed {{totalUsers}} users. Active: {{activeCount}}, Inactive: {{inactiveCount}}",
  "userId": 1
}`,
      httpHeaders: [
        { key: 'Content-Type', value: 'application/json' }
      ]
    } 
  },
  
  // No users found - send alert
  { 
    id: 'n14', 
    type: 'email',    
    label: 'No Users Alert',
    x: 860,  
    y: 380, 
    config: { 
      emailTo: 'admin@example.com',
      emailSubject: 'Warning: No Users Found',
      emailBody: 'The daily user sync found no users to process. Please check the API.',
      emailFrom: 'workflow@example.com'
    } 
  },
  
  // End node
  { 
    id: 'n15', 
    type: 'end',      
    label: 'Complete',
    x: 1580, 
    y: 250, 
    config: {} 
  },
];

export const DEMO_CONNECTIONS: Connection[] = [
  // Main flow
  { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
  { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
  { id: 'c3', from: 'n3', to: 'n4', port: 0, label: '' },
  
  // Has users? Yes -> Loop
  { id: 'c4', from: 'n4', to: 'n5', port: 0, label: 'Yes' },
  
  // Has users? No -> Alert
  { id: 'c5', from: 'n4', to: 'n14', port: 1, label: 'No' },
  { id: 'c6', from: 'n14', to: 'n15', port: 0, label: '' },
  
  // Loop body
  { id: 'c7', from: 'n5', to: 'n6', port: 0, label: 'iterate' },
  { id: 'c8', from: 'n6', to: 'n7', port: 0, label: '' },
  { id: 'c9', from: 'n7', to: 'n8', port: 0, label: '' },
  
  // Active user? Yes -> Email
  { id: 'c10', from: 'n8', to: 'n9', port: 0, label: 'Active' },
  
  // Active user? No -> Log
  { id: 'c11', from: 'n8', to: 'n10', port: 1, label: 'Inactive' },
  
  // Both paths merge to delay
  { id: 'c12', from: 'n9', to: 'n11', port: 0, label: '' },
  { id: 'c13', from: 'n10', to: 'n11', port: 0, label: '' },
  
  // Delay loops back
  { id: 'c14', from: 'n11', to: 'n5', port: 0, label: 'next' },
  
  // Loop exit -> Merge results
  { id: 'c15', from: 'n5', to: 'n12', port: 1, label: 'done' },
  { id: 'c16', from: 'n12', to: 'n13', port: 0, label: '' },
  { id: 'c17', from: 'n13', to: 'n15', port: 0, label: '' },
  
  // HTTP error handling
  { id: 'c18', from: 'n2', to: 'n14', port: 1, label: 'error', isError: true },
  { id: 'c19', from: 'n6', to: 'n11', port: 1, label: 'error', isError: true },
];

export const INITIAL_CONTEXT: ExecutionContext = {
  // Workflow metadata
  workflowName: 'User Activity Analysis',
  workflowVersion: '1.0.0',
  
  // Runtime variables (will be populated during execution)
  currentIndex: 0,
  currentUserId: 1,
  totalUsers: 0,
  activeCount: 0,
  inactiveCount: 0,
  
  // Configuration
  maxUsersToProcess: 5,
  apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  
  // Execution tracking
  startTime: new Date().toISOString(),
  environment: 'development',
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

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

export const SCRIPT_LANGUAGES = ['javascript', 'python'] as const;

export const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'First of month at midnight', value: '0 0 1 * *' },
];

// Production-ready configuration options
export const AUTH_TYPES = ['none', 'basic', 'bearer', 'api-key', 'oauth2'] as const;

export const RETRY_STRATEGIES = [
  { label: 'No retry', value: 'none' },
  { label: 'Fixed delay', value: 'fixed' },
  { label: 'Exponential backoff', value: 'exponential' },
  { label: 'Linear backoff', value: 'linear' },
] as const;

export const TIME_UNITS = [
  { label: 'Milliseconds', value: 'ms', multiplier: 1 },
  { label: 'Seconds', value: 's', multiplier: 1000 },
  { label: 'Minutes', value: 'm', multiplier: 60000 },
  { label: 'Hours', value: 'h', multiplier: 3600000 },
] as const;

export const ERROR_HANDLING_MODES = [
  { label: 'Stop on error', value: 'stop' },
  { label: 'Continue on error', value: 'continue' },
  { label: 'Retry then fail', value: 'retry-fail' },
  { label: 'Skip and log', value: 'skip-log' },
] as const;

export const WEBHOOK_AUTH_TYPES = [
  { label: 'None', value: 'none' },
  { label: 'Secret in header', value: 'header-secret' },
  { label: 'HMAC signature', value: 'hmac' },
  { label: 'Basic auth', value: 'basic' },
] as const;

export const CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
  'application/xml',
] as const;

export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;
