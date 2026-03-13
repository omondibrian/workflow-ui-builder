import { useMemo } from 'react';
import { WorkflowNode, Connection, LintIssue } from '../types';
import { generateId } from '../utils';

interface UseWorkflowLintingProps {
  nodes: WorkflowNode[];
  conns: Connection[];
}

interface UseWorkflowLintingReturn {
  lintIssues: LintIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

export const useWorkflowLinting = ({
  nodes,
  conns,
}: UseWorkflowLintingProps): UseWorkflowLintingReturn => {
  const lintIssues = useMemo((): LintIssue[] => {
    const issues: LintIssue[] = [];

    // Check for multiple triggers
    const triggers = nodes.filter((n) => n.type === 'trigger');
    if (triggers.length === 0) {
      issues.push({
        id: generateId(),
        severity: 'error',
        message: 'No trigger node found. Workflow needs at least one trigger.',
      });
    } else if (triggers.length > 1) {
      triggers.forEach((t) => {
        issues.push({
          id: generateId(),
          severity: 'warning',
          message: `Multiple triggers found: "${t.label}"`,
          nodeId: t.id,
        });
      });
    }

    // Check for unreachable nodes
    if (triggers.length > 0) {
      const reachable = new Set<string>();
      const queue = triggers.map((t) => t.id);
      
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (reachable.has(nodeId)) continue;
        reachable.add(nodeId);
        
        conns
          .filter((c) => c.from === nodeId)
          .forEach((c) => {
            if (!reachable.has(c.to)) {
              queue.push(c.to);
            }
          });
      }

      nodes.forEach((n) => {
        if (!reachable.has(n.id) && n.type !== 'trigger') {
          issues.push({
            id: generateId(),
            severity: 'warning',
            message: `Unreachable node: "${n.label}"`,
            nodeId: n.id,
          });
        }
      });
    }

    // Check for missing decision conditions
    nodes
      .filter((n) => n.type === 'decision')
      .forEach((n) => {
        if (!n.config.condition || n.config.condition.trim() === '') {
          issues.push({
            id: generateId(),
            severity: 'error',
            message: `Decision node "${n.label}" has no condition`,
            nodeId: n.id,
          });
        }
      });

    // Check for loops without exit paths
    nodes
      .filter((n) => n.type === 'loop')
      .forEach((n) => {
        const outConns = conns.filter((c) => c.from === n.id);
        const hasExit = outConns.some((c) => c.port === 1);
        if (!hasExit) {
          issues.push({
            id: generateId(),
            severity: 'error',
            message: `Loop node "${n.label}" has no exit path`,
            nodeId: n.id,
          });
        }
        if (!n.config.loopCount && !n.config.exitCondition) {
          issues.push({
            id: generateId(),
            severity: 'warning',
            message: `Loop node "${n.label}" has no loop count or exit condition`,
            nodeId: n.id,
          });
        }
      });

    // Check for delay nodes without delay configured
    nodes
      .filter((n) => n.type === 'delay')
      .forEach((n) => {
        if (!n.config.delayMs || n.config.delayMs <= 0) {
          issues.push({
            id: generateId(),
            severity: 'warning',
            message: `Delay node "${n.label}" has no delay configured`,
            nodeId: n.id,
          });
        }
      });

    // Check for nodes with no outgoing connections (except end nodes)
    nodes
      .filter((n) => n.type !== 'end')
      .forEach((n) => {
        const outConns = conns.filter((c) => c.from === n.id);
        if (outConns.length === 0) {
          issues.push({
            id: generateId(),
            severity: 'warning',
            message: `Node "${n.label}" has no outgoing connections`,
            nodeId: n.id,
          });
        }
      });

    // Check for end nodes with no incoming connections
    nodes
      .filter((n) => n.type === 'end')
      .forEach((n) => {
        const inConns = conns.filter((c) => c.to === n.id);
        if (inConns.length === 0) {
          issues.push({
            id: generateId(),
            severity: 'warning',
            message: `End node "${n.label}" has no incoming connections`,
            nodeId: n.id,
          });
        }
      });

    return issues;
  }, [nodes, conns]);

  const hasErrors = lintIssues.some((i) => i.severity === 'error');
  const hasWarnings = lintIssues.some((i) => i.severity === 'warning');

  return { lintIssues, hasErrors, hasWarnings };
};
