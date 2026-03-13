import { useState, useRef, useCallback } from 'react';
import {
  WorkflowNode,
  Connection,
  SimState,
  NodeStatus,
  LogEntry,
  StackFrame,
  ExecutionContext,
} from '../types';
import { INITIAL_CONTEXT } from '../constants';
import { generateId, getTimestamp, getExecutionDelay } from '../utils';

interface UseWorkflowSimulationProps {
  nodes: WorkflowNode[];
  conns: Connection[];
  wfName: string;
  debugMode: boolean;
  breakpts: Set<string>;
  setDbgOpen: (open: boolean) => void;
}

interface UseWorkflowSimulationReturn {
  simState: SimState;
  simNodes: Record<string, NodeStatus>;
  simConns: Set<string>;
  activeNid: string | null;
  execCtx: ExecutionContext;
  execLog: LogEntry[];
  callStack: StackFrame[];
  startSim: () => Promise<void>;
  stopSim: () => void;
  stepNext: () => void;
  pauseResume: () => void;
  clearLog: () => void;
}

export const useWorkflowSimulation = ({
  nodes,
  conns,
  wfName,
  debugMode,
  breakpts,
  setDbgOpen,
}: UseWorkflowSimulationProps): UseWorkflowSimulationReturn => {
  const [simState, setSimState] = useState<SimState>('idle');
  const [simNodes, setSimNodes] = useState<Record<string, NodeStatus>>({});
  const [simConns, setSimConns] = useState<Set<string>>(new Set());
  const [activeNid, setActiveNid] = useState<string | null>(null);
  const [execCtx, setExecCtx] = useState<ExecutionContext>({ ...INITIAL_CONTEXT });
  const [execLog, setExecLog] = useState<LogEntry[]>([]);
  const [callStack, setCallStack] = useState<StackFrame[]>([]);

  const pauseRef = useRef(false);
  const stepRef = useRef<(() => void) | null>(null);
  const stopRef = useRef(false);
  const logR = useRef<LogEntry[]>([]);
  const ctxR = useRef<ExecutionContext>({ ...INITIAL_CONTEXT });
  const snR = useRef<Record<string, NodeStatus>>({});
  const scR = useRef<Set<string>>(new Set());
  const stackR = useRef<StackFrame[]>([]);

  const log = useCallback((level: LogEntry['level'], msg: string, nodeId: string | null = null) => {
    const entry: LogEntry = { id: generateId(), ts: getTimestamp(), level, msg, nodeId };
    logR.current = [...logR.current, entry];
    setExecLog([...logR.current]);
  }, []);

  const mutCtx = useCallback((patch: Partial<ExecutionContext>) => {
    ctxR.current = { ...ctxR.current, ...patch };
    setExecCtx({ ...ctxR.current });
  }, []);

  const setNS = useCallback((id: string, status: NodeStatus['status'], extra: Partial<NodeStatus> = {}) => {
    snR.current = { ...snR.current, [id]: { status, ...extra } };
    setSimNodes({ ...snR.current });
    if (status === 'running') setActiveNid(id);
    else setActiveNid((p) => (p === id ? null : p));
  }, []);

  const sleepMs = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (!stopRef.current) setTimeout(resolve, ms);
      else resolve();
    });

  const execNode = useCallback(
    async (nid: string, nds: WorkflowNode[], css: Connection[]) => {
      if (stopRef.current) return;
      const node = nds.find((n) => n.id === nid);
      if (!node) return;

      stackR.current = [...stackR.current, { id: nid, label: node.label, type: node.type, entered: getTimestamp() }];
      setCallStack([...stackR.current]);

      // Breakpoint check
      if (debugMode && breakpts.has(nid)) {
        setNS(nid, 'paused');
        pauseRef.current = true;
        log('breakpoint', `⬡ Breakpoint hit → "${node.label}"`, nid);
        setSimState('paused');
        await new Promise<void>((resolve) => {
          stepRef.current = resolve;
        });
        if (stopRef.current) return;
        setSimState('running');
      }

      // Pause check
      if (pauseRef.current) {
        setNS(nid, 'paused');
        setSimState('paused');
        await new Promise<void>((resolve) => {
          stepRef.current = resolve;
        });
        if (stopRef.current) return;
        setSimState('running');
      }

      setNS(nid, 'running');
      log('info', `→ enter "${node.label}"`, nid);
      const t0 = Date.now();
      const delay = getExecutionDelay(node.type);
      await sleepMs(delay);
      if (stopRef.current) return;

      // Simulate side effects
      if (node.type === 'trigger') {
        mutCtx({ _trigger: node.label, _workflow_started: new Date().toISOString() });
        log('info', 'Trigger payload bound to context', nid);
      } else if (node.type === 'task') {
        const act = node.config?.actionType || 'Call API';
        const ep = node.config?.endpoint || '(none)';
        log('info', `${act} → ${ep}`, nid);
        
        // Simulate potential error (10% chance for demo)
        const hasError = Math.random() < 0.1;
        if (hasError) {
          log('error', `Task failed — simulated error`, nid);
          setNS(nid, 'error', { duration: Date.now() - t0 });
          stackR.current = stackR.current.filter((s) => s.id !== nid);
          setCallStack([...stackR.current]);
          
          // Find error port connection (port 1)
          const errorConn = css.find((c) => c.from === nid && c.port === 1);
          if (errorConn) {
            scR.current.add(errorConn.id);
            setSimConns(new Set(scR.current));
            await sleepMs(160);
            await execNode(errorConn.to, nds, css);
          }
          return;
        }
        
        if (/validate/i.test(node.label)) mutCtx({ validated: true, validation_score: 0.98 });
        if (/approve/i.test(node.label)) mutCtx({ approved: true, approved_at: new Date().toISOString() });
        if (/ledger/i.test(node.label)) mutCtx({ ledger_id: `LDG-${Math.floor(Math.random() * 9000 + 1000)}`, posted: true });
        log('success', `Task OK — ${Date.now() - t0}ms`, nid);
      } else if (node.type === 'decision') {
        const cond = node.config?.condition || 'true';
        const key = cond.split(/[ ><=!]/)[0].trim();
        const val = ctxR.current[key] ?? ctxR.current.amount;
        let result = false;
        try {
          // eslint-disable-next-line no-new-func
          result = Function('ctx', `with(ctx){return ${cond};}`)(ctxR.current);
        } catch {
          // ignore
        }
        log('info', `eval: ${cond}`, nid);
        log('info', `  ${key} = ${val}`, nid);
        log(result ? 'success' : 'warn', `  → ${result ? 'YES (port 0)' : 'NO (port 1)'}`, nid);
        mutCtx({ _last_decision: cond, _decision_result: result });
      } else if (node.type === 'parallel') {
        log('info', 'Spawning parallel branches', nid);
      } else if (node.type === 'loop') {
        const loopCount = node.config?.loopCount || 3;
        const exitCond = node.config?.exitCondition || '';
        log('info', `Loop: ${loopCount} iterations, exit: "${exitCond || 'none'}"`, nid);
        mutCtx({ _loop_iteration: 0, _loop_max: loopCount });
      } else if (node.type === 'delay') {
        const delayMs = node.config?.delayMs || 1000;
        log('info', `Delay: waiting ${delayMs}ms`, nid);
        await sleepMs(delayMs);
        log('success', `Delay complete`, nid);
      } else if (node.type === 'end') {
        mutCtx({ _status: 'COMPLETED', _ended: new Date().toISOString() });
        log('success', '✓ Workflow completed', nid);
      }

      setNS(nid, 'done', { duration: Date.now() - t0 });
      stackR.current = stackR.current.filter((s) => s.id !== nid);
      setCallStack([...stackR.current]);

      const outs = css.filter((c) => c.from === nid);
      if (!outs.length) return;

      if (node.type === 'decision') {
        const cond = node.config?.condition || 'true';
        let result = false;
        try {
          // eslint-disable-next-line no-new-func
          result = Function('ctx', `with(ctx){return ${cond};}`)(ctxR.current);
        } catch {
          // ignore
        }
        const pick = outs.find((c) => c.port === (result ? 0 : 1)) || outs[0];
        scR.current = new Set(Array.from(scR.current).concat(pick.id));
        setSimConns(new Set(scR.current));
        await sleepMs(180);
        await execNode(pick.to, nds, css);
      } else if (node.type === 'parallel') {
        for (const c of outs) {
          scR.current.add(c.id);
        }
        setSimConns(new Set(scR.current));
        await sleepMs(120);
        await Promise.all(outs.map((c) => execNode(c.to, nds, css)));
      } else if (node.type === 'loop') {
        const loopCount = node.config?.loopCount || 3;
        const exitCond = node.config?.exitCondition || '';
        const bodyConn = outs.find((c) => c.port === 0);
        const exitConn = outs.find((c) => c.port === 1);
        
        for (let i = 0; i < loopCount; i++) {
          if (stopRef.current) return;
          mutCtx({ _loop_iteration: i + 1 });
          log('info', `Loop iteration ${i + 1}/${loopCount}`, nid);
          
          // Check exit condition
          if (exitCond) {
            let shouldExit = false;
            try {
              // eslint-disable-next-line no-new-func
              shouldExit = Function('ctx', `with(ctx){return ${exitCond};}`)(ctxR.current);
            } catch {
              // ignore
            }
            if (shouldExit) {
              log('info', `Loop exit condition met: ${exitCond}`, nid);
              break;
            }
          }
          
          // Execute body
          if (bodyConn) {
            scR.current.add(bodyConn.id);
            setSimConns(new Set(scR.current));
            await sleepMs(120);
            await execNode(bodyConn.to, nds, css);
          }
        }
        
        // Exit loop
        if (exitConn) {
          scR.current.add(exitConn.id);
          setSimConns(new Set(scR.current));
          await sleepMs(120);
          await execNode(exitConn.to, nds, css);
        }
      } else if (node.type === 'task') {
        // Success path only (error handled above)
        const successConn = outs.find((c) => c.port === 0) || outs[0];
        if (successConn) {
          scR.current.add(successConn.id);
          setSimConns(new Set(scR.current));
          await sleepMs(160);
          await execNode(successConn.to, nds, css);
        }
      } else {
        for (const c of outs) {
          scR.current.add(c.id);
          setSimConns(new Set(scR.current));
          await sleepMs(160);
          await execNode(c.to, nds, css);
        }
      }
    },
    [breakpts, debugMode, log, mutCtx, setNS]
  );

  const startSim = useCallback(async () => {
    stopRef.current = false;
    pauseRef.current = false;
    stepRef.current = null;
    logR.current = [];
    snR.current = {};
    scR.current = new Set();
    stackR.current = [];
    ctxR.current = { ...INITIAL_CONTEXT };
    setSimNodes({});
    setSimConns(new Set());
    setActiveNid(null);
    setCallStack([]);
    setExecCtx({ ...INITIAL_CONTEXT });
    setExecLog([]);
    setSimState('running');
    setDbgOpen(true);
    const start = nodes.find((n) => n.type === 'trigger');
    if (!start) {
      log('error', 'No trigger node found');
      setSimState('error');
      return;
    }
    log('info', `=== ${wfName} started ===`);
    log('info', `Debug: ${debugMode ? 'ON — breakpoints active' : 'OFF'}`);
    try {
      await execNode(start.id, nodes, conns);
      if (!stopRef.current) {
        setSimState('done');
        log('info', '=== Execution complete ===');
      }
    } catch (e) {
      setSimState('error');
      log('error', `Error: ${(e as Error).message}`);
    }
  }, [nodes, conns, wfName, debugMode, log, execNode, setDbgOpen]);

  const stopSim = useCallback(() => {
    stopRef.current = true;
    if (stepRef.current) {
      stepRef.current();
      stepRef.current = null;
    }
    pauseRef.current = false;
    setSimState('idle');
    setSimNodes({});
    setSimConns(new Set());
    setActiveNid(null);
    setCallStack([]);
    log('warn', '=== Stopped ===');
  }, [log]);

  const stepNext = useCallback(() => {
    if (stepRef.current) {
      pauseRef.current = false;
      const f = stepRef.current;
      stepRef.current = null;
      f();
    }
  }, []);

  const pauseResume = useCallback(() => {
    if (simState === 'running') {
      pauseRef.current = true;
      setSimState('paused');
      log('warn', 'Paused');
    } else if (simState === 'paused') {
      pauseRef.current = false;
      setSimState('running');
      log('info', 'Resumed');
      if (stepRef.current) {
        const f = stepRef.current;
        stepRef.current = null;
        f();
      }
    }
  }, [simState, log]);

  const clearLog = useCallback(() => {
    logR.current = [];
    setExecLog([]);
  }, []);

  return {
    simState,
    simNodes,
    simConns,
    activeNid,
    execCtx,
    execLog,
    callStack,
    startSim,
    stopSim,
    stepNext,
    pauseResume,
    clearLog,
  };
};
