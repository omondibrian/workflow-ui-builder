import React, { useState, useRef } from 'react';
import { StickyNote as StickyNoteType } from '../types';

interface StickyNoteProps {
  note: StickyNoteType;
  zoom: number;
  onUpdate: (id: string, updates: Partial<StickyNoteType>) => void;
  onDelete: (id: string) => void;
}

const STICKY_COLORS = [
  '#fef08a', // yellow
  '#fca5a5', // red
  '#86efac', // green
  '#93c5fd', // blue
  '#f9a8d4', // pink
  '#fdba74', // orange
];

export const StickyNote: React.FC<StickyNoteProps> = ({
  note,
  zoom,
  onUpdate,
  onDelete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX / zoom - note.x,
      y: e.clientY / zoom - note.y,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      onUpdate(note.id, {
        x: ev.clientX / zoom - dragOffset.current.x,
        y: ev.clientY / zoom - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(note.id, { text: e.target.value });
  };

  const handleTextBlur = () => {
    setIsEditing(false);
  };

  const handleColorChange = (color: string) => {
    onUpdate(note.id, { color });
    setShowColorPicker(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: note.x,
        top: note.y,
        width: note.width || 150,
        minHeight: note.height || 100,
        background: note.color,
        borderRadius: 2,
        boxShadow: isDragging
          ? '0 8px 32px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        cursor: isDragging ? 'grabbing' : 'grab',
        transform: isDragging ? 'scale(1.02)' : 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.2s, transform 0.2s',
        zIndex: isDragging ? 1000 : 10,
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Header with controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 6px',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
        }}
      >
        {/* Color picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowColorPicker(!showColorPicker);
            }}
            style={{
              width: 16,
              height: 16,
              background: 'rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Change color"
          >
            🎨
          </button>
          {showColorPicker && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: 4,
                padding: 4,
                display: 'flex',
                gap: 4,
                zIndex: 1001,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {STICKY_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  style={{
                    width: 20,
                    height: 20,
                    background: color,
                    border: note.color === color ? '2px solid #000' : '1px solid #30363d',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          style={{
            width: 16,
            height: 16,
            background: 'rgba(0,0,0,0.1)',
            border: 'none',
            borderRadius: 2,
            cursor: 'pointer',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Delete note"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 8 }}>
        {isEditing ? (
          <textarea
            autoFocus
            value={note.text}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 60,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: 12,
              color: '#000',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 12,
              color: '#000',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {note.text || 'Double-click to edit...'}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          cursor: 'nwse-resize',
          background: 'rgba(0,0,0,0.1)',
          borderRadius: '0 0 2px 0',
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = note.width || 150;
          const startHeight = note.height || 100;

          const handleResize = (ev: MouseEvent) => {
            const newWidth = Math.max(100, startWidth + (ev.clientX - startX) / zoom);
            const newHeight = Math.max(60, startHeight + (ev.clientY - startY) / zoom);
            onUpdate(note.id, { width: newWidth, height: newHeight });
          };

          const handleResizeEnd = () => {
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', handleResizeEnd);
          };

          window.addEventListener('mousemove', handleResize);
          window.addEventListener('mouseup', handleResizeEnd);
        }}
      />
    </div>
  );
};
