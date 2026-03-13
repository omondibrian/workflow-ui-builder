import { 
  WorkflowNode, 
  Connection, 
  ExecutionContext, 
  NodeStatus, 
  LogEntry 
} from './types';
import { uid } from './utils';

export type ExecutionMode = 'simulate' | 'execute';

export interface ExecutionOptions {
  mode: ExecutionMode;
  timeout?: number; // ms
  maxIterations?: number;
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string, result: unknown) => void;
  onNodeError?: (nodeId: string, error: Error) => void;
  onLog?: (entry: LogEntry) => void;
  onContextUpdate?: (ctx: ExecutionContext) => void;
}

interface NodeExecutor {
  (node: WorkflowNode, ctx: ExecutionContext): Promise<{ result: unknown; nextPort: number }>;
}

// Simulated HTTP request (for demo purposes)
const simulateHttpRequest = async (
  method: string,
  url: string,
  headers?: Record<string, string>,
  body?: string,
  timeout?: number
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> => {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, Math.random() * 500 + 200));
  
  // Simulate response based on URL patterns
  if (url.includes('error') || url.includes('fail')) {
    throw new Error('HTTP request failed: 500 Internal Server Error');
  }
  
  return {
    status: 200,
    body: { success: true, method, url, timestamp: new Date().toISOString() },
    headers: { 'content-type': 'application/json' },
  };
};

// Simulated email send
const simulateEmailSend = async (
  to: string,
  subject: string,
  body: string,
  from?: string
): Promise<{ messageId: string; sent: boolean }> => {
  await new Promise((r) => setTimeout(r, Math.random() * 300 + 100));
  
  if (!to || !to.includes('@')) {
    throw new Error('Invalid email address');
  }
  
  return {
    messageId: `msg_${uid()}`,
    sent: true,
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
    const fn = new Function('ctx', `
      'use strict';
      with (ctx) { return Boolean(${condition}); }
    `);
    return fn(ctx);
  } catch (e) {
    console.error('Condition evaluation failed:', e);
    return false;
  }
};

// Template string interpolation
const interpolateTemplate = (template: string, ctx: ExecutionContext): string => {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = path.split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object') {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, ctx as unknown);
    return value !== undefined ? String(value) : match;
  });
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
      const url = interpolateTemplate(node.config.httpUrl || '', ctx);
      const body = node.config.httpBody ? interpolateTemplate(node.config.httpBody, ctx) : undefined;
      
      const response = await simulateHttpRequest(
        node.config.httpMethod || 'GET',
        url,
        undefined,
        body,
        node.config.httpTimeout
      );
      
      return { result: { response }, nextPort: 0 };
    } catch (e) {
      return { result: { error: (e as Error).message }, nextPort: 1 };
    }
  },

  email: async (node, ctx) => {
    try {
      const to = interpolateTemplate(node.config.emailTo || '', ctx);
      const subject = interpolateTemplate(node.config.emailSubject || '', ctx);
      const body = interpolateTemplate(node.config.emailBody || '', ctx);
      
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
  private nodeStatuses: Map<string, NodeStatus> = new Map();
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor(
    nodes: WorkflowNode[],
    connections: Connection[],
    options: ExecutionOptions
  ) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.connections = connections;
    this.options = options;
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
    const ctx = { ...initialContext };

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
    return ctx;
  }

  private async executeNode(nodeId: string, ctx: ExecutionContext): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    const node = this.nodes.get(nodeId);
    if (!node) {
      this.log('warn', `Node ${nodeId} not found`);
      return;
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
    this.isPaused = false;
    this.log('info', 'Execution resumed');
  }

  stop(): void {
    this.isRunning = false;
    this.log('info', 'Execution stopped');
  }

  getStatus(nodeId: string): NodeStatus | undefined {
    return this.nodeStatuses.get(nodeId);
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
