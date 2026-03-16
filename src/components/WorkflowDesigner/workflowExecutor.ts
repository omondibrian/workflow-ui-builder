import { 
  WorkflowNode, 
  Connection, 
  ExecutionContext, 
  NodeStatus, 
  LogEntry,
  WorkflowSecret 
} from './types';
import { uid } from './utils';

export type ExecutionMode = 'simulate' | 'execute';

export interface ExecutionOptions {
  mode: ExecutionMode;
  timeout?: number; // ms
  maxIterations?: number;
  breakpoints?: Set<string>; // Node IDs to pause at
  stepMode?: boolean; // When true, pause after every node execution
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string, result: unknown) => void;
  onNodeError?: (nodeId: string, error: Error) => void;
  onBreakpoint?: (nodeId: string) => void; // Called when hitting a breakpoint
  onLog?: (entry: LogEntry) => void;
  onContextUpdate?: (ctx: ExecutionContext) => void;
}

interface NodeExecutor {
  (node: WorkflowNode, ctx: ExecutionContext): Promise<{ result: unknown; nextPort: number }>;
}

// Real HTTP request using fetch API
const executeHttpRequest = async (
  method: string,
  url: string,
  headers?: Record<string, string>,
  body?: string,
  timeout: number = 30000
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };

    // Only add body for methods that support it
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      requestInit.body = body;
    }

    const response = await fetch(url, requestInit);
    clearTimeout(timeoutId);

    // Parse response body
    let responseBody: unknown;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      status: response.status,
      body: responseBody,
      headers: responseHeaders,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

// Simulated email send (in real app, would call email API)
const simulateEmailSend = async (
  to: string,
  subject: string,
  body: string,
  from?: string
): Promise<{ messageId: string; sent: boolean; details: object }> => {
  // In a real implementation, this would call an email service API
  // For demo, we log and simulate success
  console.log('📧 Email Send Request:', { to, from, subject, body: body.substring(0, 100) + '...' });
  await new Promise((r) => setTimeout(r, 200));
  
  if (!to || !to.includes('@')) {
    throw new Error('Invalid email address');
  }
  
  return {
    messageId: `msg_${uid()}`,
    sent: true,
    details: { to, from, subject, sentAt: new Date().toISOString() }
  };
};

// Execute JavaScript code in a sandboxed context
const executeScript = (code: string, ctx: ExecutionContext): unknown => {
  try {
    // Create a function with ctx as parameter
    const fn = new Function('ctx', `
      'use strict';
      ${code.includes('return') ? code : `return (${code})`}
    `);
    return fn(ctx);
  } catch (e) {
    throw new Error(`Script execution failed: ${(e as Error).message}`);
  }
};

// Evaluate a condition against context
const evaluateCondition = (condition: string, ctx: ExecutionContext): boolean => {
  try {
    // Create a function that destructures ctx properties for easy access
    const keys = Object.keys(ctx);
    const values = Object.values(ctx);
    // Build a function that takes ctx values as arguments
    const fn = new Function(...keys, `return Boolean(${condition});`);
    return fn(...values);
  } catch (e) {
    console.error('Condition evaluation failed:', e);
    return false;
  }
};

// Template string interpolation with secrets support
const interpolateTemplate = (
  template: string, 
  ctx: ExecutionContext, 
  secrets: WorkflowSecret[] = []
): string => {
  // First resolve secrets ({{secrets.SECRET_NAME}})
  let result = template.replace(/\{\{secrets\.(\w+)\}\}/g, (match, secretName) => {
    const secret = secrets.find(s => s.name === secretName);
    if (secret) {
      return secret.value;
    }
    console.warn(`Secret not found: ${secretName}`);
    return match; // Keep original if not found
  });
  
  // Then resolve context variables ({{variable}} or {{nested.path}})
  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, ctx as unknown);
    return value !== undefined ? String(value) : match;
  });
  
  return result;
};

// Node executors for each type
const nodeExecutors: Partial<Record<string, NodeExecutor>> = {
  trigger: async (node, ctx) => {
    return { result: { triggered: true, type: node.config.triggerType }, nextPort: 0 };
  },

  webhook: async (node, ctx) => {
    return { 
      result: { 
        payload: ctx.webhook || {}, 
        path: node.config.webhookPath,
        triggered: true 
      }, 
      nextPort: 0 
    };
  },

  schedule: async (node, ctx) => {
    return {
      result: {
        scheduledTime: new Date().toISOString(),
        cron: node.config.cronExpression,
        timezone: node.config.timezone || 'UTC',
      },
      nextPort: 0,
    };
  },

  http: async (node, ctx) => {
    try {
      const secrets = (ctx._secrets as WorkflowSecret[]) || [];
      const url = interpolateTemplate(node.config.httpUrl || '', ctx, secrets);
      const body = node.config.httpBody ? interpolateTemplate(node.config.httpBody, ctx, secrets) : undefined;
      
      // Convert headers array to object
      const headers: Record<string, string> = {};
      if (node.config.httpHeaders) {
        for (const h of node.config.httpHeaders) {
          headers[h.key] = interpolateTemplate(h.value, ctx, secrets);
        }
      }
      
      // Handle authentication with secrets support
      if (node.config.httpAuthType === 'bearer') {
        const token = interpolateTemplate(node.config.httpBearerToken || '', ctx, secrets);
        headers['Authorization'] = `Bearer ${token}`;
      } else if (node.config.httpAuthType === 'basic') {
        const username = interpolateTemplate(node.config.httpUsername || '', ctx, secrets);
        const password = interpolateTemplate(node.config.httpPassword || '', ctx, secrets);
        headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
      } else if (node.config.httpAuthType === 'api-key') {
        const headerName = node.config.httpApiKeyHeader || 'X-API-Key';
        const keyValue = interpolateTemplate(node.config.httpApiKeyValue || '', ctx, secrets);
        headers[headerName] = keyValue;
      }
      
      console.log(`🌐 HTTP ${node.config.httpMethod || 'GET'}: ${url}`);
      
      const response = await executeHttpRequest(
        node.config.httpMethod || 'GET',
        url,
        headers,
        body,
        node.config.httpTimeout || 30000
      );
      
      console.log(`✅ HTTP Response: ${response.status}`, response.body);
      
      // Store response in ctx.response for easy access (common pattern)
      (ctx as Record<string, unknown>).response = response;
      
      // Store response data in context for easy access by subsequent nodes
      // Use outputVariable if specified, otherwise use 'httpResponse'
      const outputKey = node.config.outputVariable || 'httpResponse';
      (ctx as Record<string, unknown>)[outputKey] = response.body;
      (ctx as Record<string, unknown>)[`${outputKey}_status`] = response.status;
      (ctx as Record<string, unknown>)[`${outputKey}_headers`] = response.headers;
      
      // Also store with node label (sanitized) for multi-HTTP workflows
      const sanitizedLabel = node.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      (ctx as Record<string, unknown>)[sanitizedLabel] = response.body;
      
      return { result: { response, data: response.body }, nextPort: 0 };
    } catch (e) {
      console.error(`❌ HTTP Error:`, (e as Error).message);
      // Store error in context
      (ctx as Record<string, unknown>).response = { error: (e as Error).message, status: 0, body: null, headers: {} };
      return { result: { error: (e as Error).message }, nextPort: 1 };
    }
  },

  email: async (node, ctx) => {
    try {
      const secrets = (ctx._secrets as WorkflowSecret[]) || [];
      const to = interpolateTemplate(node.config.emailTo || '', ctx, secrets);
      const subject = interpolateTemplate(node.config.emailSubject || '', ctx, secrets);
      const body = interpolateTemplate(node.config.emailBody || '', ctx, secrets);
      
      const result = await simulateEmailSend(to, subject, body, node.config.emailFrom);
      return { result, nextPort: 0 };
    } catch (e) {
      return { result: { error: (e as Error).message }, nextPort: 1 };
    }
  },

  script: async (node, ctx) => {
    try {
      const code = node.config.scriptCode || 'return null;';
      const result = executeScript(code, ctx);
      
      // Store result in output variable if specified
      if (node.config.outputVariable) {
        (ctx as Record<string, unknown>)[node.config.outputVariable] = result;
      }
      
      return { result, nextPort: 0 };
    } catch (e) {
      return { result: { error: (e as Error).message }, nextPort: 1 };
    }
  },

  transform: async (node, ctx) => {
    try {
      const expr = node.config.transformExpression || '{}';
      const result = executeScript(expr, ctx);
      
      // Merge result into context
      if (result && typeof result === 'object') {
        Object.assign(ctx, result);
      }
      
      if (node.config.outputVariable) {
        (ctx as Record<string, unknown>)[node.config.outputVariable] = result;
      }
      
      return { result, nextPort: 0 };
    } catch (e) {
      return { result: { error: (e as Error).message }, nextPort: 0 };
    }
  },

  task: async (node, ctx) => {
    try {
      // Simulate task execution
      await new Promise((r) => setTimeout(r, Math.random() * 400 + 100));
      return { 
        result: { 
          action: node.config.actionType, 
          endpoint: node.config.endpoint,
          success: true 
        }, 
        nextPort: 0 
      };
    } catch (e) {
      return { result: { error: (e as Error).message }, nextPort: 1 };
    }
  },

  decision: async (node, ctx) => {
    const condition = node.config.condition || 'false';
    const result = evaluateCondition(condition, ctx);
    return { result: { condition, result }, nextPort: result ? 0 : 1 };
  },

  delay: async (node, ctx) => {
    const delayMs = node.config.delayMs || 1000;
    await new Promise((r) => setTimeout(r, delayMs));
    return { result: { delayed: delayMs }, nextPort: 0 };
  },

  loop: async (node, ctx) => {
    // Loop control is handled by the executor
    const iteration = (ctx._loopIteration as number) || 0;
    const loopCount = node.config.loopCount || 3;
    const exitCondition = node.config.exitCondition;
    
    // Check exit condition
    if (exitCondition && evaluateCondition(exitCondition, ctx)) {
      return { result: { exited: true, iteration }, nextPort: 1 };
    }
    
    // Check loop count
    if (iteration >= loopCount) {
      return { result: { completed: true, iterations: iteration }, nextPort: 1 };
    }
    
    return { result: { iteration: iteration + 1 }, nextPort: 0 };
  },

  parallel: async (node, ctx) => {
    // Parallel execution is handled by the executor
    return { result: { parallel: true }, nextPort: 0 };
  },

  end: async (node, ctx) => {
    return { result: { completed: true, context: ctx }, nextPort: -1 };
  },
};

// Main workflow executor
export class WorkflowExecutor {
  private nodes: Map<string, WorkflowNode>;
  private connections: Connection[];
  private options: ExecutionOptions;
  private secrets: WorkflowSecret[];
  private nodeStatuses: Map<string, NodeStatus> = new Map();
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastExecutedNodeId: string | null = null;
  private resumeResolve: (() => void) | null = null;

  constructor(
    nodes: WorkflowNode[],
    connections: Connection[],
    options: ExecutionOptions,
    secrets: WorkflowSecret[] = []
  ) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.connections = connections;
    this.options = options;
    this.secrets = secrets;
  }

  private log(level: LogEntry['level'], msg: string, nodeId: string | null = null): void {
    if (this.options.onLog) {
      this.options.onLog({
        id: uid(),
        ts: new Date().toISOString(),
        level,
        msg,
        nodeId,
      });
    }
  }

  private getOutgoingConnections(nodeId: string, port: number): Connection[] {
    return this.connections.filter((c) => c.from === nodeId && c.port === port);
  }

  private findStartNodes(): WorkflowNode[] {
    const targetIds = new Set(this.connections.map((c) => c.to));
    return Array.from(this.nodes.values()).filter(
      (n) => !targetIds.has(n.id) && ['trigger', 'webhook', 'schedule'].includes(n.type)
    );
  }

  async execute(initialContext: ExecutionContext = {}): Promise<ExecutionContext> {
    this.isRunning = true;
    this.isPaused = false;
    // Inject secrets into context for use by interpolateTemplate
    const ctx = { ...initialContext, _secrets: this.secrets };

    const startNodes = this.findStartNodes();
    if (startNodes.length === 0) {
      this.log('error', 'No start nodes found in workflow');
      return ctx;
    }

    this.log('info', `Starting workflow execution with ${startNodes.length} entry point(s)`);

    try {
      for (const startNode of startNodes) {
        await this.executeNode(startNode.id, ctx);
      }
      this.log('success', 'Workflow execution completed');
    } catch (e) {
      this.log('error', `Workflow execution failed: ${(e as Error).message}`);
    }

    this.isRunning = false;
    // Remove secrets from returned context
    const { _secrets, ...cleanCtx } = ctx as Record<string, unknown>;
    return cleanCtx as ExecutionContext;
  }

  private async executeNode(nodeId: string, ctx: ExecutionContext): Promise<void> {
    if (!this.isRunning) return;
    
    // Wait if paused
    while (this.isPaused) {
      await new Promise<void>((resolve) => {
        this.resumeResolve = resolve;
      });
    }
    
    if (!this.isRunning) return;

    const node = this.nodes.get(nodeId);
    if (!node) {
      this.log('warn', `Node ${nodeId} not found`);
      return;
    }

    // Check for breakpoint BEFORE executing the node
    if (this.options.breakpoints?.has(nodeId)) {
      this.log('breakpoint', `⬡ Breakpoint hit: ${node.label}`, nodeId);
      this.isPaused = true;
      this.nodeStatuses.set(nodeId, { status: 'paused' });
      this.options.onBreakpoint?.(nodeId);
      
      // Wait for resume
      await new Promise<void>((resolve) => {
        this.resumeResolve = resolve;
      });
      
      if (!this.isRunning) return;
    }

    this.options.onNodeStart?.(nodeId);
    this.nodeStatuses.set(nodeId, { status: 'running' });

    const startTime = Date.now();
    this.log('info', `Executing: ${node.label}`, nodeId);

    try {
      const executor = nodeExecutors[node.type];
      if (!executor) {
        throw new Error(`No executor for node type: ${node.type}`);
      }

      const { result, nextPort } = await executor(node, ctx);
      const duration = Date.now() - startTime;

      // Store result in context
      ctx[`_node_${nodeId}_result`] = result;
      this.options.onContextUpdate?.(ctx);

      this.nodeStatuses.set(nodeId, { status: 'done', duration });
      this.options.onNodeComplete?.(nodeId, result);
      this.log('success', `Completed: ${node.label} (${duration}ms)`, nodeId);
      this.lastExecutedNodeId = nodeId;

      // Check if we should pause after this node (stepMode from debug mode)
      if (this.options.stepMode) {
        this.isPaused = true;
        this.nodeStatuses.set(nodeId, { status: 'paused', duration });
        this.options.onBreakpoint?.(nodeId);
        this.log('info', `⏸ Paused after: ${node.label}`, nodeId);
        
        // Wait for next step or resume
        await new Promise<void>((resolve) => {
          this.resumeResolve = resolve;
        });
        
        if (!this.isRunning) return;
      }

      // Continue to next nodes
      if (nextPort >= 0) {
        const nextConnections = this.getOutgoingConnections(nodeId, nextPort);
        for (const conn of nextConnections) {
          // Apply data mappings if present
          if (conn.mappings && conn.mappings.length > 0) {
            for (const mapping of conn.mappings) {
              const sourceValue = this.getFieldValue(mapping.sourceField, result, ctx);
              let finalValue = sourceValue;
              
              // Apply transform if present
              if (mapping.transform) {
                try {
                  const transformFn = new Function('value', 'ctx', `return (${mapping.transform})(value, ctx);`);
                  finalValue = transformFn(sourceValue, ctx);
                } catch (e) {
                  this.log('warn', `Transform failed: ${mapping.transform}`, nodeId);
                }
              }
              
              ctx[mapping.targetField] = finalValue;
            }
          }
          
          await this.executeNode(conn.to, ctx);
        }
      }
    } catch (e) {
      const duration = Date.now() - startTime;
      this.nodeStatuses.set(nodeId, { status: 'error', duration });
      this.options.onNodeError?.(nodeId, e as Error);
      this.log('error', `Error in ${node.label}: ${(e as Error).message}`, nodeId);

      // Try error port (port 1)
      const errorConnections = this.getOutgoingConnections(nodeId, 1);
      for (const conn of errorConnections) {
        ctx._error = (e as Error).message;
        await this.executeNode(conn.to, ctx);
      }
    }
  }

  private getFieldValue(
    field: string, 
    nodeResult: unknown, 
    ctx: ExecutionContext
  ): unknown {
    if (field.startsWith('_')) {
      return ctx[field];
    }
    
    // Navigate nested path
    const parts = field.split('.');
    let value: unknown = nodeResult;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  pause(): void {
    this.isPaused = true;
    this.log('info', 'Execution paused');
  }

  resume(): void {
    // Disable step mode and continue running without pausing
    this.options.stepMode = false;
    this.isPaused = false;
    this.log('info', 'Execution resumed (continuous mode)');
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }
  
  step(): void {
    // Execute just ONE node, then pause again
    // Re-enable stepMode to ensure we pause after the next node
    this.options.stepMode = true;
    this.isPaused = false;
    this.log('info', 'Stepping to next node...');
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }
  
  stepOver(): void {
    // Alias for step
    this.step();
  }

  stop(): void {
    this.isRunning = false;
    this.log('info', 'Execution stopped');
  }

  getStatus(nodeId: string): NodeStatus | undefined {
    return this.nodeStatuses.get(nodeId);
  }

  // Execute a single node in isolation with provided context
  static async executeSingleNode(
    node: WorkflowNode,
    context: ExecutionContext,
    secrets: WorkflowSecret[] = [],
    callbacks?: {
      onStart?: () => void;
      onComplete?: (result: unknown) => void;
      onError?: (error: Error) => void;
      onLog?: (entry: LogEntry) => void;
    }
  ): Promise<{ result: unknown; context: ExecutionContext; duration: number }> {
    const startTime = Date.now();
    const ctx: Record<string, unknown> = { ...context, _secrets: secrets };
    
    const log = (level: LogEntry['level'], msg: string) => {
      callbacks?.onLog?.({
        id: uid(),
        ts: new Date().toISOString(),
        level,
        msg,
        nodeId: node.id,
      });
    };

    log('info', `🔧 Executing single node: ${node.label}`);
    callbacks?.onStart?.();

    try {
      const executor = nodeExecutors[node.type];
      if (!executor) {
        throw new Error(`No executor for node type: ${node.type}`);
      }

      const { result } = await executor(node, ctx as ExecutionContext);
      const duration = Date.now() - startTime;

      // Store result in context
      ctx[`_node_${node.id}_result`] = result;

      log('success', `✓ ${node.label} completed (${duration}ms)`);
      callbacks?.onComplete?.(result);

      // Remove secrets from returned context
      const { _secrets, ...cleanCtx } = ctx;
      
      return { result, context: cleanCtx as ExecutionContext, duration };
    } catch (error) {
      const err = error as Error;
      log('error', `✕ ${node.label} failed: ${err.message}`);
      callbacks?.onError?.(err);
      throw error;
    }
  }
}

// Factory function for easy usage
export const createWorkflowExecutor = (
  nodes: WorkflowNode[],
  connections: Connection[],
  options: Partial<ExecutionOptions> = {}
): WorkflowExecutor => {
  return new WorkflowExecutor(nodes, connections, {
    mode: 'simulate',
    timeout: 30000,
    maxIterations: 100,
    ...options,
  });
};
