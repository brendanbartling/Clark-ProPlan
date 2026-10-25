import React, { useState, useRef, useMemo, useEffect } from 'react';
import { StickyNote, Trade } from '../types';
import { calculateSnappedDuration } from '../utils/resizeLogic';

interface StickyNoteProps {
  task: StickyNote;
  trade?: Trade;
  dayWidth: number;
  isSelected: boolean;
  isCritical: boolean;
  isBeingDragged?: boolean;
  cardHeight?: number;
  diamondSize?: number;
  onSelect: (task: StickyNote) => void;
  onUpdateName?: (taskId: string, newName: string) => void;
  onStartConnectionDrag: (taskId: string, side: 'left' | 'right', startX: number, startY: number) => void;
  onCompleteConnection: (targetTaskId: string) => void;
  onResizeDuration?: (taskId: string, newDuration: number) => void;
  onCardPointerDown?: (task: StickyNote, e: React.PointerEvent) => void;
}

export const StickyNoteComponent: React.FC<StickyNoteProps> = ({
  task,
  trade,
  dayWidth,
  isSelected,
  isCritical,
  isBeingDragged = false,
  cardHeight: propCardHeight,
  diamondSize: propDiamondSize,
  onSelect,
  onUpdateName,
  onStartConnectionDrag,
  onCompleteConnection,
  onResizeDuration,
  onCardPointerDown,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragDurationPreview, setDragDurationPreview] = useState<number | null>(null);

  // Inline name editing state
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineName, setInlineName] = useState(task.name);

  useEffect(() => {
    if (!isInlineEditing) {
      setInlineName(task.name);
    }
  }, [task.name, isInlineEditing]);

  const startXRef = useRef(0);
  const startDurationRef = useRef(task.duration);

  const tradeColor = trade?.color || '#00A9E0';
  const effectiveDuration = dragDurationPreview !== null ? dragDurationPreview : task.duration;
  const widthPx = Math.max(90, effectiveDuration * dayWidth - 12);
  const cardHeight = propCardHeight || 84;

  // Responsive milestone diamond dimension: matches row height, scales with zoom, bounded by column width
  const diamondSize =
    propDiamondSize || Math.max(48, Math.min(cardHeight, dayWidth - 12));

  // Dynamic font sizing for legibility across durations and title lengths
  const fontStyle = useMemo(() => {
    const len = task.name.length;
    if (task.shape !== 'rectangle') {
      if (diamondSize >= 78) {
        if (len <= 14) return { fontSize: '13px', lineHeight: '16px' };
        if (len <= 26) return { fontSize: '11px', lineHeight: '14px' };
        return { fontSize: '10px', lineHeight: '12px' };
      }
      if (len <= 14) return { fontSize: '11px', lineHeight: '13px' };
      if (len <= 26) return { fontSize: '10px', lineHeight: '12px' };
      return { fontSize: '9px', lineHeight: '11px' };
    }
    if (widthPx >= 350) {
      if (len <= 24) return { fontSize: '18px', lineHeight: '22px' };
      if (len <= 48) return { fontSize: '16px', lineHeight: '20px' };
      return { fontSize: '14px', lineHeight: '18px' };
    } else if (widthPx >= 200) {
      if (len <= 18) return { fontSize: '16px', lineHeight: '20px' };
      if (len <= 40) return { fontSize: '14px', lineHeight: '18px' };
      return { fontSize: '13px', lineHeight: '17px' };
    } else {
      if (len <= 14) return { fontSize: '15px', lineHeight: '18px' };
      if (len <= 28) return { fontSize: '13px', lineHeight: '16px' };
      return { fontSize: '11px', lineHeight: '14px' };
    }
  }, [task.name, task.shape, widthPx]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (isResizing || isInlineEditing) return;
    if (onCardPointerDown) {
      onCardPointerDown(task, e);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInlineEditing(true);
    setInlineName(task.name);
  };

  const commitInlineEdit = () => {
    setIsInlineEditing(false);
    const trimmed = inlineName.trim();
    if (trimmed && trimmed !== task.name && onUpdateName) {
      onUpdateName(task.id, trimmed);
    } else {
      setInlineName(task.name);
    }
  };

  const handleConnectionDotPointerDown = (
    e: React.PointerEvent,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onStartConnectionDrag(task.id, side, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handlePointerUp = (_e: React.PointerEvent) => {
    onCompleteConnection(task.id);
  };

  // Drag-to-resize duration handler (Pure flat, zero shadows)
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startDurationRef.current = task.duration;

    const handlePointerMoveWindow = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const snapped = calculateSnappedDuration(startDurationRef.current, deltaX, dayWidth);
      setDragDurationPreview(snapped);
    };

    const handlePointerUpWindow = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMoveWindow);
      window.removeEventListener('pointerup', handlePointerUpWindow);
      window.removeEventListener('pointercancel', handlePointerUpWindow);

      const deltaX = upEvent.clientX - startXRef.current;
      const finalDuration = calculateSnappedDuration(startDurationRef.current, deltaX, dayWidth);

      setIsResizing(false);
      setDragDurationPreview(null);

      if (onResizeDuration && finalDuration !== task.duration) {
        onResizeDuration(task.id, finalDuration);
      }
    };

    window.addEventListener('pointermove', handlePointerMoveWindow);
    window.addEventListener('pointerup', handlePointerUpWindow);
    window.addEventListener('pointercancel', handlePointerUpWindow);
  };

  // Critical path red outline styling
  const criticalOutlineClass = isCritical
    ? 'outline outline-3 outline-red-600 outline-offset-2 ring-2 ring-red-500'
    : '';

  // Shape rendering: NOISE-FREE & SHADOW-FREE flat design with clean Inter font
  const renderShapeContent = () => {
    if (task.shape === 'diamond') {
      return (
        <div
          className={`relative group mx-auto cursor-pointer select-none flex items-center justify-center transition-transform ${
            isSelected ? 'scale-105 z-20' : 'hover:scale-105 z-10'
          } ${criticalOutlineClass} ${isBeingDragged ? 'opacity-25' : ''}`}
          style={{ width: `${diamondSize}px`, height: `${diamondSize}px` }}
          onPointerDown={handlePointerDown}
          onDoubleClick={handleDoubleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onPointerUp={handlePointerUp}
          data-testid={`sticky-${task.id}`}
        >
          {/* Vector SVG Diamond - Exact row height, crisp geometry, perfectly centered tips */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-sm"
          >
            <polygon
              points="50,2 98,50 50,98 2,50"
              fill={tradeColor}
              stroke={isSelected ? '#001430' : 'rgba(0, 20, 48, 0.45)'}
              strokeWidth={isSelected ? '5' : '3'}
              strokeLinejoin="round"
            />
          </svg>

          {/* Diamond Content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center p-1 leading-tight w-full max-w-[72%]">
            {isInlineEditing ? (
              <input
                type="text"
                value={inlineName}
                autoFocus
                onChange={(e) => setInlineName(e.target.value)}
                onBlur={commitInlineEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitInlineEdit();
                  if (e.key === 'Escape') {
                    setInlineName(task.name);
                    setIsInlineEditing(false);
                  }
                  e.stopPropagation();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full text-center bg-white text-slate-900 font-bold px-1 py-0.5 rounded border border-[#001430] text-[11px] outline-none"
              />
            ) : (
              <span
                className="font-bold line-clamp-3 font-sans px-0.5 tracking-tight"
                style={{
                  color: trade?.textColor || '#FFFFFF',
                  fontSize: fontStyle.fontSize,
                  lineHeight: fontStyle.lineHeight,
                }}
              >
                {task.name}
              </span>
            )}
          </div>

          {/* Miro Anchor Dots - Positioned safely outward with exact vertical centering */}
          {isHovered && !isResizing && !isBeingDragged && !isInlineEditing && (
            <>
              <button
                type="button"
                onPointerDown={(e) => handleConnectionDotPointerDown(e, 'left')}
                className="absolute -left-5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#00A9E0] hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair z-35 shadow-sm"
                title="Drag to create dependency (Predecessor)"
                aria-label={`Link dependency from ${task.id} left`}
              >
                <div className="w-2 h-2 rounded-full bg-[#00A9E0]" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => handleConnectionDotPointerDown(e, 'right')}
                className="absolute -right-5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border-2 border-[#00A9E0] hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair z-35 shadow-sm"
                title="Drag to create dependency (Successor)"
                aria-label={`Link dependency from ${task.id} right`}
              >
                <div className="w-2 h-2 rounded-full bg-[#00A9E0]" />
              </button>
            </>
          )}
        </div>
      );
    }

    // Default: Rectangle sticky note - ZERO SHADOWS, FLAT & CLEAN
    return (
      <div
        className={`relative group rounded-md cursor-grab active:cursor-grabbing select-none flex items-center justify-center p-3 border-2 ${
          isSelected
            ? 'ring-4 ring-[#0066B3] scale-[1.01] z-20'
            : 'hover:brightness-105 z-10'
        } ${criticalOutlineClass} ${isBeingDragged ? 'opacity-25' : ''}`}
        style={{
          width: `${widthPx}px`,
          height: `${cardHeight}px`,
          backgroundColor: tradeColor,
          borderColor: isSelected ? '#001430' : 'rgba(0, 20, 48, 0.45)',
        }}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerUp={handlePointerUp}
        data-testid={`sticky-${task.id}`}
      >
        {/* Center: Activity Name with Dynamic Font Scaling or Inline Input */}
        <div className="relative z-10 w-full text-center px-1">
          {isInlineEditing ? (
            <input
              type="text"
              value={inlineName}
              autoFocus
              onChange={(e) => setInlineName(e.target.value)}
              onBlur={commitInlineEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitInlineEdit();
                if (e.key === 'Escape') {
                  setInlineName(task.name);
                  setIsInlineEditing(false);
                }
                e.stopPropagation();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full text-center bg-white text-slate-900 font-black px-2 py-1 rounded border-2 border-[#001430] outline-none shadow-md font-sans"
              style={{ fontSize: fontStyle.fontSize }}
            />
          ) : (
            <p
              className="font-bold font-sans select-none tracking-tight line-clamp-3"
              style={{
                color: trade?.textColor || '#FFFFFF',
                fontSize: fontStyle.fontSize,
                lineHeight: fontStyle.lineHeight,
              }}
              title="Double-click to edit activity name directly"
            >
              {task.name}
            </p>
          )}
        </div>

        {/* Live Duration Snap Indicator while dragging resize handle */}
        {isResizing && dragDurationPreview !== null && (
          <div className="absolute -top-7 right-0 bg-[#001430] text-white font-mono text-[11px] font-bold px-2 py-0.5 rounded z-40 border border-white/30 pointer-events-none">
            {dragDurationPreview} {dragDurationPreview === 1 ? 'Day' : 'Days'}
          </div>
        )}

        {/* Right-edge Duration Resize Handle (Snap to day) - Sits cleanly at right-0 */}
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute top-0 right-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/25 flex items-center justify-center z-25 group/resize transition-colors rounded-r-[4px]"
          title="Drag side to change duration (snaps to day)"
        >
          <div className="w-1 h-6 rounded-full bg-white/70 group-hover/resize:bg-white transition-all" />
        </div>

        {/* Miro Anchor Dots - Positioned safely outward (-left-5 and -right-5) to avoid resize bar */}
        {isHovered && !isResizing && !isBeingDragged && !isInlineEditing && (
          <>
            <button
              type="button"
              onPointerDown={(e) => handleConnectionDotPointerDown(e, 'left')}
              className="absolute -left-5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-[#00A9E0] hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair z-35 shadow-sm"
              title="Drag from this dot to create dependency (Predecessor)"
              aria-label={`Link dependency from ${task.id} left`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#00A9E0]" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => handleConnectionDotPointerDown(e, 'right')}
              className="absolute -right-5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-[#00A9E0] hover:scale-125 transition-transform flex items-center justify-center cursor-crosshair z-35 shadow-sm"
              title="Drag from this dot to create dependency (Successor)"
              aria-label={`Link dependency from ${task.id} right`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#00A9E0]" />
            </button>
          </>
        )}
      </div>
    );
  };

  return <div className="inline-block relative">{renderShapeContent()}</div>;
};
