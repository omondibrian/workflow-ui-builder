import { WorkflowNode, Point, NodeType } from './types';
import { TYPES, NODE_WIDTH, NODE_HEIGHT } from './constants';

export const generateId = (): string => Math.random().toString(36).slice(2, 7);

// Alias for generateId
export const uid = generateId;

export const getTimestamp = (): string => new Date().toISOString().slice(11, 23);

export const getOutputPort = (node: WorkflowNode, port: number): Point => {
  const outs = TYPES[node.type].outs;
  return {
    x: node.x + NODE_WIDTH,
    y: outs > 1 ? node.y + (port === 0 ? NODE_HEIGHT * 0.3 : NODE_HEIGHT * 0.7) : node.y + NODE_HEIGHT / 2,
  };
};

export const getInputPort = (node: WorkflowNode): Point => {
  return {
    x: node.x,
    y: node.y + NODE_HEIGHT / 2,
  };
};

export const getBezierPath = (start: Point, end: Point): string => {
  const controlOffset = Math.max(Math.abs(end.x - start.x) * 0.45, 52);
  return `M${start.x},${start.y} C${start.x + controlOffset},${start.y} ${end.x - controlOffset},${end.y} ${end.x},${end.y}`;
};

export const getExecutionDelay = (type: NodeType): number => {
  const delays: Record<NodeType, number> = {
    trigger: 500,
    task: 800,
    decision: 550,
    parallel: 350,
    loop: 300,
    delay: 100,
    end: 400,
  };
  return delays[type] || 600;
};
