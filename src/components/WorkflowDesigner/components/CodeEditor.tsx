import React, { useRef, useEffect, useState } from 'react';
import Editor, { OnMount, Monaco, loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { WorkflowSecret } from '../types';

// Configure Monaco to use CDN
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs'
  }
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'javascript' | 'python' | 'json' | 'html' | 'css';
  height?: number | string;
  placeholder?: string;
  readOnly?: boolean;
  secrets?: WorkflowSecret[];
}

// JavaScript/TypeScript completions for workflow context
const jsCompletions = [
  { label: 'ctx', kind: 'Variable', detail: 'Workflow context object', insertText: 'ctx' },
  { label: 'ctx.response', kind: 'Property', detail: 'HTTP response from previous node', insertText: 'ctx.response' },
  { label: 'ctx.response.body', kind: 'Property', detail: 'Response body data', insertText: 'ctx.response.body' },
  { label: 'ctx.response.status', kind: 'Property', detail: 'HTTP status code', insertText: 'ctx.response.status' },
  { label: 'return', kind: 'Keyword', detail: 'Return value to context', insertText: 'return {\n  $0\n};', insertTextRules: 4 },
  { label: 'console.log', kind: 'Function', detail: 'Log to console', insertText: 'console.log($0)', insertTextRules: 4 },
  { label: 'JSON.stringify', kind: 'Function', detail: 'Convert to JSON string', insertText: 'JSON.stringify($0)', insertTextRules: 4 },
  { label: 'JSON.parse', kind: 'Function', detail: 'Parse JSON string', insertText: 'JSON.parse($0)', insertTextRules: 4 },
  { label: 'Array.isArray', kind: 'Function', detail: 'Check if value is array', insertText: 'Array.isArray($0)', insertTextRules: 4 },
  { label: 'Object.keys', kind: 'Function', detail: 'Get object keys', insertText: 'Object.keys($0)', insertTextRules: 4 },
  { label: 'Object.values', kind: 'Function', detail: 'Get object values', insertText: 'Object.values($0)', insertTextRules: 4 },
  { label: 'filter', kind: 'Method', detail: 'Filter array elements', insertText: 'filter((item) => $0)', insertTextRules: 4 },
  { label: 'map', kind: 'Method', detail: 'Map array elements', insertText: 'map((item) => $0)', insertTextRules: 4 },
  { label: 'reduce', kind: 'Method', detail: 'Reduce array', insertText: 'reduce((acc, item) => $0, initialValue)', insertTextRules: 4 },
  { label: 'find', kind: 'Method', detail: 'Find array element', insertText: 'find((item) => $0)', insertTextRules: 4 },
  { label: 'forEach', kind: 'Method', detail: 'Iterate array', insertText: 'forEach((item) => {\n  $0\n})', insertTextRules: 4 },
  { label: 'new Date()', kind: 'Function', detail: 'Create date object', insertText: 'new Date()' },
  { label: 'Date.now()', kind: 'Function', detail: 'Current timestamp', insertText: 'Date.now()' },
  { label: 'Math.round', kind: 'Function', detail: 'Round number', insertText: 'Math.round($0)', insertTextRules: 4 },
  { label: 'Math.floor', kind: 'Function', detail: 'Floor number', insertText: 'Math.floor($0)', insertTextRules: 4 },
  { label: 'Math.ceil', kind: 'Function', detail: 'Ceil number', insertText: 'Math.ceil($0)', insertTextRules: 4 },
  { label: 'parseInt', kind: 'Function', detail: 'Parse integer', insertText: 'parseInt($0, 10)', insertTextRules: 4 },
  { label: 'parseFloat', kind: 'Function', detail: 'Parse float', insertText: 'parseFloat($0)', insertTextRules: 4 },
  { label: 'String', kind: 'Function', detail: 'Convert to string', insertText: 'String($0)', insertTextRules: 4 },
  { label: 'Number', kind: 'Function', detail: 'Convert to number', insertText: 'Number($0)', insertTextRules: 4 },
  { label: 'Boolean', kind: 'Function', detail: 'Convert to boolean', insertText: 'Boolean($0)', insertTextRules: 4 },
];

// System variables available for template interpolation
const systemVariables = [
  { label: '{{secrets.', detail: 'Access workflow secrets', insertText: '{{secrets.$0}}', insertTextRules: 4 },
  { label: '{{result}}', detail: 'Result from previous node', insertText: '{{result}}' },
  { label: '{{response}}', detail: 'HTTP response from API calls', insertText: '{{response}}' },
  { label: '{{response.status}}', detail: 'HTTP response status code', insertText: '{{response.status}}' },
  { label: '{{response.body}}', detail: 'HTTP response body', insertText: '{{response.body}}' },
  { label: '{{response.headers}}', detail: 'HTTP response headers', insertText: '{{response.headers}}' },
  { label: '{{data}}', detail: 'Data from transform or script node', insertText: '{{data}}' },
  { label: '{{items}}', detail: 'Items array for iteration', insertText: '{{items}}' },
  { label: '{{item}}', detail: 'Current item in iteration', insertText: '{{item}}' },
  { label: '{{currentIndex}}', detail: 'Current iteration index in loops', insertText: '{{currentIndex}}' },
  { label: '{{totalItems}}', detail: 'Total items in current collection', insertText: '{{totalItems}}' },
  { label: '{{startTime}}', detail: 'Workflow execution start time', insertText: '{{startTime}}' },
  { label: '{{environment}}', detail: 'Current environment (development/production)', insertText: '{{environment}}' },
  { label: '{{workflowName}}', detail: 'Name of the current workflow', insertText: '{{workflowName}}' },
  { label: '{{workflowVersion}}', detail: 'Version of the workflow', insertText: '{{workflowVersion}}' },
  { label: '{{executionId}}', detail: 'Unique execution identifier', insertText: '{{executionId}}' },
];

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'javascript',
  height = 150,
  placeholder,
  readOnly = false,
  secrets = [],
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const completionDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);

  // Register completion provider when editor mounts or secrets change
  useEffect(() => {
    if (!monacoRef.current || !editorMounted) return;
    
    // Dispose previous completion provider
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
    }

    const monaco = monacoRef.current;
    
    // Register completion provider for JSON (headers, body, etc.)
    if (language === 'json') {
      completionDisposableRef.current = monaco.languages.registerCompletionItemProvider('json', {
        triggerCharacters: ['{', '.', 's', 'r', 'e', 'd', 'i', 'w', 'c', 't'],
        provideCompletionItems: (model, position) => {
          const lineContent = model.getLineContent(position.lineNumber);
          const textUntilPosition = lineContent.substring(0, position.column - 1);

          // Find the start position for replacement - look for {{ pattern
          const openBracesMatch = textUntilPosition.match(/\{\{([^}]*)$/);
          
          const suggestions: any[] = [];

          if (openBracesMatch) {
            const query = openBracesMatch[1].toLowerCase();
            const startColumn = position.column - openBracesMatch[1].length;
            
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: startColumn,
              endColumn: position.column,
            };

            // Filter and add system variables
            systemVariables.forEach((item) => {
              const varName = item.label.replace(/^\{\{|\}\}$/g, '');
              if (query === '' || varName.toLowerCase().includes(query)) {
                suggestions.push({
                  label: item.label,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  detail: item.detail,
                  insertText: varName + '}}',
                  range,
                  sortText: '0' + varName, // Sort system vars first
                });
              }
            });

            // Add secrets
            secrets.forEach((secret) => {
              const secretRef = `secrets.${secret.name}`;
              if (query === '' || secretRef.toLowerCase().includes(query) || secret.name.toLowerCase().includes(query)) {
                suggestions.push({
                  label: `{{secrets.${secret.name}}}`,
                  kind: monaco.languages.CompletionItemKind.Constant,
                  detail: secret.description || 'Secret value',
                  insertText: `secrets.${secret.name}}}`,
                  range,
                  sortText: '1' + secret.name, // Sort secrets after system vars
                });
              }
            });

            // Add secrets. prefix suggestion
            if (query === '' || 'secrets'.includes(query)) {
              suggestions.push({
                label: '{{secrets.',
                kind: monaco.languages.CompletionItemKind.Folder,
                detail: 'Access workflow secrets',
                insertText: 'secrets.',
                range,
                sortText: '1_secrets',
              });
            }
          }

          return { suggestions };
        },
      });
    }

    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
      }
    };
  }, [secrets, language, editorMounted]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Signal that editor is ready for completion provider registration
    setEditorMounted(true);

    // Configure editor
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      glyphMargin: false,
      folding: true,
      lineDecorationsWidth: 5,
      lineNumbersMinChars: 3,
      renderLineHighlight: 'line',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
      fontSize: 12,
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
      tabSize: 2,
      wordWrap: 'on',
      automaticLayout: true,
      // Enable suggestions inside strings (for template variables like {{secrets.X}})
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true, // Important: enable inside strings
      },
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true,
      },
    });

    // Register custom completions for JavaScript
    if (language === 'javascript') {
      monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = jsCompletions.map((item) => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind[item.kind as keyof typeof monaco.languages.CompletionItemKind] || monaco.languages.CompletionItemKind.Variable,
            detail: item.detail,
            insertText: item.insertText,
            insertTextRules: item.insertTextRules as editor.ITextModel['uri'] extends string ? number : undefined,
            range,
          }));

          return { suggestions };
        },
      });
    }

    // Set theme
    monaco.editor.defineTheme('workflow-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'ffa657' },
        { token: 'constant', foreground: '79c0ff' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b2233',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editor.selectionBackground': '#264f7844',
        'editor.inactiveSelectionBackground': '#264f7822',
        'editorCursor.foreground': '#58a6ff',
        'editorWhitespace.foreground': '#484f5833',
        'editorIndentGuide.background': '#30363d',
        'editorIndentGuide.activeBackground': '#484f58',
        'editor.findMatchBackground': '#ffa65744',
        'editor.findMatchHighlightBackground': '#ffa65722',
        'editorSuggestWidget.background': '#161b22',
        'editorSuggestWidget.border': '#30363d',
        'editorSuggestWidget.foreground': '#e6edf3',
        'editorSuggestWidget.selectedBackground': '#388bfd33',
        'editorSuggestWidget.highlightForeground': '#58a6ff',
        'editorHoverWidget.background': '#161b22',
        'editorHoverWidget.border': '#30363d',
      },
    });
    monaco.editor.setTheme('workflow-dark');
  };

  const handleChange = (newValue: string | undefined) => {
    onChange(newValue || '');
  };

  return (
    <div
      style={{
        border: '1px solid #30363d',
        borderRadius: 4,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        loading={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            background: '#0d1117',
            color: '#8b949e',
            fontSize: 11,
          }}>
            Loading editor...
          </div>
        }
        options={{
          readOnly,
          domReadOnly: readOnly,
        }}
      />
      {!value && placeholder && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 48,
            color: '#484f58',
            fontSize: 12,
            pointerEvents: 'none',
            fontFamily: "'Fira Code', 'Consolas', monospace",
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
