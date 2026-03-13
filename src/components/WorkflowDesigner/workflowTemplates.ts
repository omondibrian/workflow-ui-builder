import { WorkflowNode, Connection, ExecutionContext } from './types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  initialContext: ExecutionContext;
}

// Template 1: User Activity Analysis (uses JSONPlaceholder API)
export const userActivityTemplate: WorkflowTemplate = {
  id: 'tpl_user_activity',
  name: 'User Activity Analysis',
  description: 'Fetches users from JSONPlaceholder API, analyzes their posts, and sends reports for active users.',
  category: 'Data Processing',
  nodes: [
    { 
      id: 'n1', 
      type: 'schedule',  
      label: 'Daily User Sync',  
      x: 60, y: 200, 
      config: { cronExpression: '0 9 * * *', timezone: 'UTC' } 
    },
    { 
      id: 'n2', 
      type: 'http',     
      label: 'Fetch Users',
      x: 260, y: 200, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://jsonplaceholder.typicode.com/users',
        httpTimeout: 10000
      } 
    },
    { 
      id: 'n3', 
      type: 'transform', 
      label: 'Extract Users',   
      x: 460, y: 200, 
      config: { 
        transformExpression: `{ users: ctx.response?.body || [], totalUsers: (ctx.response?.body || []).length }`,
        outputVariable: 'userData'
      } 
    },
    { 
      id: 'n4', 
      type: 'decision', 
      label: 'Has Users?',
      x: 660, y: 200, 
      config: { condition: 'totalUsers > 0' } 
    },
    { 
      id: 'n5', 
      type: 'script',   
      label: 'Process Users',
      x: 860, y: 120, 
      config: { 
        scriptLanguage: 'javascript',
        scriptCode: `const users = ctx.users || [];
return {
  activeUsers: users.filter(u => u.id <= 5),
  processedAt: new Date().toISOString(),
  summary: \`Processed \${users.length} users\`
};`,
        outputVariable: 'result'
      } 
    },
    { 
      id: 'n6', 
      type: 'email',    
      label: 'Send Report',
      x: 1060, y: 120, 
      config: { 
        emailTo: 'admin@example.com',
        emailSubject: 'User Sync Complete',
        emailBody: '{{result.summary}}\nProcessed at: {{result.processedAt}}',
        emailFrom: 'workflow@example.com'
      } 
    },
    { 
      id: 'n7', 
      type: 'email',    
      label: 'No Users Alert',
      x: 860, y: 300, 
      config: { 
        emailTo: 'admin@example.com',
        emailSubject: 'Warning: No Users Found',
        emailBody: 'The daily user sync found no users.',
        emailFrom: 'workflow@example.com'
      } 
    },
    { 
      id: 'n8', 
      type: 'end',      
      label: 'Complete',
      x: 1260, y: 200, 
      config: {} 
    },
  ],
  connections: [
    { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
    { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
    { id: 'c3', from: 'n3', to: 'n4', port: 0, label: '' },
    { id: 'c4', from: 'n4', to: 'n5', port: 0, label: 'Yes' },
    { id: 'c5', from: 'n4', to: 'n7', port: 1, label: 'No' },
    { id: 'c6', from: 'n5', to: 'n6', port: 0, label: '' },
    { id: 'c7', from: 'n6', to: 'n8', port: 0, label: '' },
    { id: 'c8', from: 'n7', to: 'n8', port: 0, label: '' },
    { id: 'c9', from: 'n2', to: 'n7', port: 1, label: 'error', isError: true },
  ],
  initialContext: {
    workflowName: 'User Activity Analysis',
    totalUsers: 0,
  },
};

// Template 2: GitHub Repository Monitor
export const githubMonitorTemplate: WorkflowTemplate = {
  id: 'tpl_github_monitor',
  name: 'GitHub Repo Monitor',
  description: 'Monitors a GitHub repository for new commits and stars, sends alerts when thresholds are met.',
  category: 'DevOps',
  nodes: [
    { 
      id: 'n1', 
      type: 'webhook',  
      label: 'GitHub Webhook',  
      x: 60, y: 200, 
      config: { webhookPath: '/api/github/events', webhookMethod: 'POST' } 
    },
    { 
      id: 'n2', 
      type: 'transform', 
      label: 'Parse Event',
      x: 260, y: 200, 
      config: { 
        transformExpression: `{
  eventType: ctx.webhook?.headers?.['x-github-event'] || 'unknown',
  repository: ctx.webhook?.body?.repository?.full_name,
  sender: ctx.webhook?.body?.sender?.login,
  action: ctx.webhook?.body?.action
}`,
        outputVariable: 'event'
      } 
    },
    { 
      id: 'n3', 
      type: 'decision', 
      label: 'Is Push Event?',
      x: 460, y: 200, 
      config: { condition: 'event.eventType === "push"' } 
    },
    { 
      id: 'n4', 
      type: 'http',     
      label: 'Get Repo Stats',
      x: 660, y: 120, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://api.github.com/repos/{{event.repository}}',
        httpTimeout: 5000
      } 
    },
    { 
      id: 'n5', 
      type: 'decision', 
      label: 'Stars > 100?',
      x: 860, y: 120, 
      config: { condition: 'response.body.stargazers_count > 100' } 
    },
    { 
      id: 'n6', 
      type: 'email',    
      label: 'Popular Repo Alert',
      x: 1060, y: 40, 
      config: { 
        emailTo: 'team@example.com',
        emailSubject: 'Popular Repo Updated: {{event.repository}}',
        emailBody: 'Repository {{event.repository}} has {{response.body.stargazers_count}} stars and was just updated by {{event.sender}}.',
        emailFrom: 'github-bot@example.com'
      } 
    },
    { 
      id: 'n7', 
      type: 'transform', 
      label: 'Log Other Events',
      x: 660, y: 300, 
      config: { 
        transformExpression: `{ logged: true, event: ctx.event, timestamp: new Date().toISOString() }`,
        outputVariable: 'logEntry'
      } 
    },
    { 
      id: 'n8', 
      type: 'end',      
      label: 'Complete',
      x: 1060, y: 200, 
      config: {} 
    },
  ],
  connections: [
    { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
    { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
    { id: 'c3', from: 'n3', to: 'n4', port: 0, label: 'Push' },
    { id: 'c4', from: 'n3', to: 'n7', port: 1, label: 'Other' },
    { id: 'c5', from: 'n4', to: 'n5', port: 0, label: '' },
    { id: 'c6', from: 'n5', to: 'n6', port: 0, label: 'Yes' },
    { id: 'c7', from: 'n5', to: 'n8', port: 1, label: 'No' },
    { id: 'c8', from: 'n6', to: 'n8', port: 0, label: '' },
    { id: 'c9', from: 'n7', to: 'n8', port: 0, label: '' },
  ],
  initialContext: {
    workflowName: 'GitHub Repo Monitor',
  },
};

// Template 3: Data Pipeline with Loop
export const dataPipelineTemplate: WorkflowTemplate = {
  id: 'tpl_data_pipeline',
  name: 'Posts Data Pipeline',
  description: 'Fetches posts from API, loops through them, transforms data, and aggregates results.',
  category: 'Data Processing',
  nodes: [
    { 
      id: 'n1', 
      type: 'trigger',  
      label: 'Manual Start',  
      x: 60, y: 200, 
      config: { triggerType: 'Manual' } 
    },
    { 
      id: 'n2', 
      type: 'http',     
      label: 'Fetch Posts',
      x: 260, y: 200, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://jsonplaceholder.typicode.com/posts?_limit=10',
        httpTimeout: 10000
      } 
    },
    { 
      id: 'n3', 
      type: 'transform', 
      label: 'Initialize',   
      x: 460, y: 200, 
      config: { 
        transformExpression: `{
  posts: ctx.response?.body || [],
  totalPosts: (ctx.response?.body || []).length,
  currentIndex: 0,
  processedPosts: [],
  stats: { totalWords: 0, avgLength: 0 }
}`,
        outputVariable: 'pipeline'
      } 
    },
    { 
      id: 'n4', 
      type: 'loop',     
      label: 'Process Posts',
      x: 660, y: 200, 
      config: { loopCount: 10, exitCondition: 'currentIndex >= totalPosts' } 
    },
    { 
      id: 'n5', 
      type: 'script',   
      label: 'Analyze Post',
      x: 860, y: 120, 
      config: { 
        scriptLanguage: 'javascript',
        scriptCode: `const post = ctx.posts[ctx.currentIndex];
const words = post.body.split(/\\s+/).length;
return {
  postId: post.id,
  title: post.title,
  wordCount: words,
  processed: true
};`,
        outputVariable: 'currentPost'
      } 
    },
    { 
      id: 'n6', 
      type: 'transform', 
      label: 'Update Stats',
      x: 1060, y: 120, 
      config: { 
        transformExpression: `{
  processedPosts: [...(ctx.processedPosts || []), ctx.currentPost],
  stats: {
    totalWords: (ctx.stats?.totalWords || 0) + ctx.currentPost.wordCount,
    count: (ctx.processedPosts?.length || 0) + 1
  },
  currentIndex: ctx.currentIndex + 1
}`,
        outputVariable: 'updated'
      } 
    },
    { 
      id: 'n7', 
      type: 'delay',    
      label: 'Rate Limit',
      x: 1260, y: 120, 
      config: { delayMs: 100 } 
    },
    { 
      id: 'n8', 
      type: 'script',   
      label: 'Final Summary',
      x: 860, y: 300, 
      config: { 
        scriptLanguage: 'javascript',
        scriptCode: `const stats = ctx.stats || { totalWords: 0, count: 0 };
return {
  totalPostsProcessed: stats.count,
  totalWords: stats.totalWords,
  avgWordsPerPost: Math.round(stats.totalWords / (stats.count || 1)),
  completedAt: new Date().toISOString()
};`,
        outputVariable: 'summary'
      } 
    },
    { 
      id: 'n9', 
      type: 'http',     
      label: 'Post Results',
      x: 1060, y: 300, 
      config: { 
        httpMethod: 'POST',
        httpUrl: 'https://jsonplaceholder.typicode.com/posts',
        httpBody: `{"title": "Pipeline Report", "body": "Processed {{summary.totalPostsProcessed}} posts with {{summary.totalWords}} total words", "userId": 1}`,
        httpHeaders: [{ key: 'Content-Type', value: 'application/json' }]
      } 
    },
    { 
      id: 'n10', 
      type: 'end',      
      label: 'Complete',
      x: 1260, y: 300, 
      config: {} 
    },
  ],
  connections: [
    { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
    { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
    { id: 'c3', from: 'n3', to: 'n4', port: 0, label: '' },
    { id: 'c4', from: 'n4', to: 'n5', port: 0, label: 'iterate' },
    { id: 'c5', from: 'n5', to: 'n6', port: 0, label: '' },
    { id: 'c6', from: 'n6', to: 'n7', port: 0, label: '' },
    { id: 'c7', from: 'n7', to: 'n4', port: 0, label: 'next' },
    { id: 'c8', from: 'n4', to: 'n8', port: 1, label: 'done' },
    { id: 'c9', from: 'n8', to: 'n9', port: 0, label: '' },
    { id: 'c10', from: 'n9', to: 'n10', port: 0, label: '' },
    { id: 'c11', from: 'n2', to: 'n10', port: 1, label: 'error', isError: true },
  ],
  initialContext: {
    workflowName: 'Posts Data Pipeline',
    currentIndex: 0,
    totalPosts: 0,
  },
};

// Template 4: API Health Check
export const healthCheckTemplate: WorkflowTemplate = {
  id: 'tpl_health_check',
  name: 'Multi-API Health Check',
  description: 'Checks multiple public APIs for availability and response times.',
  category: 'Monitoring',
  nodes: [
    { 
      id: 'n1', 
      type: 'schedule',  
      label: 'Every 5 Minutes',  
      x: 60, y: 200, 
      config: { cronExpression: '*/5 * * * *', timezone: 'UTC' } 
    },
    { 
      id: 'n2', 
      type: 'parallel', 
      label: 'Check APIs',
      x: 260, y: 200, 
      config: {} 
    },
    { 
      id: 'n3', 
      type: 'http',     
      label: 'Check JSONPlaceholder',
      x: 460, y: 80, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://jsonplaceholder.typicode.com/posts/1',
        httpTimeout: 5000
      } 
    },
    { 
      id: 'n4', 
      type: 'http',     
      label: 'Check GitHub API',
      x: 460, y: 200, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://api.github.com/zen',
        httpTimeout: 5000
      } 
    },
    { 
      id: 'n5', 
      type: 'http',     
      label: 'Check httpbin',
      x: 460, y: 320, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://httpbin.org/get',
        httpTimeout: 5000
      } 
    },
    { 
      id: 'n6', 
      type: 'script',   
      label: 'Aggregate Results',
      x: 700, y: 200, 
      config: { 
        scriptLanguage: 'javascript',
        scriptCode: `const results = {
  jsonplaceholder: { status: 'ok', checked: new Date().toISOString() },
  github: { status: 'ok', checked: new Date().toISOString() },
  httpbin: { status: 'ok', checked: new Date().toISOString() }
};
const allHealthy = Object.values(results).every(r => r.status === 'ok');
return { results, allHealthy, timestamp: new Date().toISOString() };`,
        outputVariable: 'healthReport'
      } 
    },
    { 
      id: 'n7', 
      type: 'decision', 
      label: 'All Healthy?',
      x: 940, y: 200, 
      config: { condition: 'healthReport.allHealthy === true' } 
    },
    { 
      id: 'n8', 
      type: 'transform', 
      label: 'Log Success',
      x: 1140, y: 120, 
      config: { 
        transformExpression: `{ logged: true, status: 'healthy', at: ctx.healthReport.timestamp }`,
        outputVariable: 'log'
      } 
    },
    { 
      id: 'n9', 
      type: 'email',    
      label: 'Alert: Unhealthy',
      x: 1140, y: 300, 
      config: { 
        emailTo: 'ops@example.com',
        emailSubject: 'ALERT: API Health Check Failed',
        emailBody: 'One or more APIs are unhealthy. Check the dashboard for details.',
        emailFrom: 'monitor@example.com'
      } 
    },
    { 
      id: 'n10', 
      type: 'end',      
      label: 'Complete',
      x: 1340, y: 200, 
      config: {} 
    },
  ],
  connections: [
    { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
    { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
    { id: 'c3', from: 'n2', to: 'n4', port: 0, label: '' },
    { id: 'c4', from: 'n2', to: 'n5', port: 0, label: '' },
    { id: 'c5', from: 'n3', to: 'n6', port: 0, label: '' },
    { id: 'c6', from: 'n4', to: 'n6', port: 0, label: '' },
    { id: 'c7', from: 'n5', to: 'n6', port: 0, label: '' },
    { id: 'c8', from: 'n6', to: 'n7', port: 0, label: '' },
    { id: 'c9', from: 'n7', to: 'n8', port: 0, label: 'Yes' },
    { id: 'c10', from: 'n7', to: 'n9', port: 1, label: 'No' },
    { id: 'c11', from: 'n8', to: 'n10', port: 0, label: '' },
    { id: 'c12', from: 'n9', to: 'n10', port: 0, label: '' },
  ],
  initialContext: {
    workflowName: 'Multi-API Health Check',
  },
};

// Template 5: One-Time Data Fetch (Single Execution)
export const oneTimeDataFetchTemplate: WorkflowTemplate = {
  id: 'tpl_one_time_data',
  name: 'One-Time Data Fetch',
  description: 'Single execution workflow: fetches data once, transforms it, and saves to a variable. No loops or schedules.',
  category: 'Data Processing',
  nodes: [
    { 
      id: 'n1', 
      type: 'trigger',  
      label: 'Run Once',  
      x: 60, y: 200, 
      config: { triggerType: 'Manual' } 
    },
    { 
      id: 'n2', 
      type: 'http',     
      label: 'Fetch Data',
      x: 260, y: 200, 
      config: { 
        httpMethod: 'GET',
        httpUrl: 'https://jsonplaceholder.typicode.com/todos/1',
        httpTimeout: 10000
      } 
    },
    { 
      id: 'n3', 
      type: 'transform', 
      label: 'Extract Data',   
      x: 460, y: 200, 
      config: { 
        transformExpression: `{
  data: ctx.response?.body || {},
  fetchedAt: new Date().toISOString(),
  status: ctx.response?.status || 0
}`,
        outputVariable: 'result'
      } 
    },
    { 
      id: 'n4', 
      type: 'decision', 
      label: 'Success?',
      x: 660, y: 200, 
      config: { condition: 'result.status >= 200 && result.status < 300' } 
    },
    { 
      id: 'n5', 
      type: 'script',   
      label: 'Process Data',
      x: 860, y: 120, 
      config: { 
        scriptLanguage: 'javascript',
        scriptCode: `const data = ctx.result?.data || {};
return {
  processed: true,
  id: data.id,
  title: data.title,
  completed: data.completed,
  summary: \`Task #\${data.id}: \${data.title}\`
};`,
        outputVariable: 'output'
      } 
    },
    { 
      id: 'n6', 
      type: 'transform', 
      label: 'Handle Error',
      x: 860, y: 300, 
      config: { 
        transformExpression: `{ error: true, message: 'Failed to fetch data', status: ctx.result?.status }`,
        outputVariable: 'output'
      } 
    },
    { 
      id: 'n7', 
      type: 'end',      
      label: 'Done',
      x: 1060, y: 200, 
      config: {} 
    },
  ],
  connections: [
    { id: 'c1', from: 'n1', to: 'n2', port: 0, label: '' },
    { id: 'c2', from: 'n2', to: 'n3', port: 0, label: '' },
    { id: 'c3', from: 'n3', to: 'n4', port: 0, label: '' },
    { id: 'c4', from: 'n4', to: 'n5', port: 0, label: 'Yes' },
    { id: 'c5', from: 'n4', to: 'n6', port: 1, label: 'No' },
    { id: 'c6', from: 'n5', to: 'n7', port: 0, label: '' },
    { id: 'c7', from: 'n6', to: 'n7', port: 0, label: '' },
    { id: 'c8', from: 'n2', to: 'n6', port: 1, label: 'error', isError: true },
  ],
  initialContext: {
    workflowName: 'One-Time Data Fetch',
  },
};

// Export all templates
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  userActivityTemplate,
  githubMonitorTemplate,
  dataPipelineTemplate,
  healthCheckTemplate,
  oneTimeDataFetchTemplate,
];

// Template categories
export const TEMPLATE_CATEGORIES = [
  'Data Processing',
  'DevOps',
  'Monitoring',
  'Integrations',
];
