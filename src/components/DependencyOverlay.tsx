import React from 'react';
import { Dependency, DraggingConnection, StickyNote } from '../types';

export interface TaskCanvasPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DependencyOverlayProps {
  dependencies: Dependency[];
  tasks: StickyNote[];
  selectedTaskId: string | null;
  criticalTaskIds: Set<string>;
  draggingConn: DraggingConnection | null;
  taskPositions: Map<string, TaskCanvasPosition>;
  onDeleteDependency: (depId: string) => void;
}

/**
 * Calculates a smooth cubic bezier path and its exact parametric midpoint at t = 0.5
 */
function calculateBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  fromSide: 'left' | 'right' = 'right',
  toSide: 'left' | 'right' = 'left'
): { path: string; midX: number; midY: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;

  let cp1x: number;
  let cp1y: number;
  let cp2x: number;
  let cp2y: number;

  if (fromSide === 'right' && toSide === 'left') {
    if (x2 >= x1 + 10) {
      const offset = Math.max(24, Math.min(dx * 0.45, 120));
      cp1x = x1 + offset;
      cp1y = y1;
      cp2x = x2 - offset;
      cp2y = y2;
    } else {
      // Backward or same-day dependency: curve gracefully around
      const loopY = dy >= 0 ? Math.min(y1, y2) - 45 : Math.max(y1, y2) + 45;
      cp1x = x1 + 55;
      cp1y = loopY;
      cp2x = x2 - 55;
      cp2y = loopY;
    }
  } else if (fromSide === 'left' && toSide === 'left') {
    // Start-to-Start (SS)
    const curveOffset = Math.max(30, Math.min(Math.abs(dy) * 0.35, 90));
    const minX = Math.min(x1, x2) - curveOffset;
    cp1x = minX;
    cp1y = y1;
    cp2x = minX;
    cp2y = y2;
  } else if (fromSide === 'right' && toSide === 'right') {
    // Finish-to-Finish (FF)
    const curveOffset = Math.max(30, Math.min(Math.abs(dy) * 0.35, 90));
    const maxX = Math.max(x1, x2) + curveOffset;
    cp1x = maxX;
    cp1y = y1;
    cp2x = maxX;
    cp2y = y2;
  } else {
    // SF or default
    const offset = 40;
    cp1x = x1 - offset;
    cp1y = y1;
    cp2x = x2 + offset;
    cp2y = y2;
  }

  const path = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

  // Exact cubic bezier point at t = 0.5: B(0.5) = 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
  const midX = 0.125 * x1 + 0.375 * cp1x + 0.375 * cp2x + 0.125 * x2;
  const midY = 0.125 * y1 + 0.375 * cp1y + 0.375 * cp2y + 0.125 * y2;

  return { path, midX, midY };
}

export const DependencyOverlay: React.FC<DependencyOverlayProps> = ({
  dependencies,
  tasks: _tasks,
  selectedTaskId,
  criticalTaskIds,
  draggingConn,
  taskPositions,
  onDeleteDependency,
}) => {
  // Helper to compute center coordinates of task anchors in canvas space
  const getAnchorPos = (
    taskId: string,
    side: 'left' | 'right'
  ): { x: number; y: number } | null => {
    const pos = taskPositions.get(taskId);
    if (!pos) return null;

    const x = side === 'left' ? pos.x : pos.x + pos.width;
    const y = pos.y + pos.height / 2;
    return { x, y };
  };

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-15 overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <defs>
        {/* Clip path that prevents dependency arrows from drawing over the sticky Locations & Zones column (x < 256) */}
        <clipPath id="board-grid-clip">
          <rect x="256" y="0" width="100000" height="100000" />
        </clipPath>

        {/* Normal Arrowhead (Bright Blue / Deep Navy) - Exactly centered at tip */}
        <marker
          id="dep-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <polygon points="0 1, 8 4, 0 7" fill="#0066B3" />
        </marker>

        {/* Selected / Active Arrowhead */}
        <marker
          id="dep-arrow-active"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
        >
          <polygon points="0 1.5, 9 5, 0 8.5" fill="#00A9E0" />
        </marker>

        {/* Critical Path Arrowhead */}
        <marker
          id="dep-arrow-critical"
          markerWidth="9"
          markerHeight="9"
          refX="7.5"
          refY="4.5"
          orient="auto"
        >
          <polygon points="0 1, 8 4.5, 0 8" fill="#E11D48" />
        </marker>
      </defs>

      {/* Render all existing dependency lines inside grid clip */}
      <g clipPath="url(#board-grid-clip)">
        {dependencies.map((dep) => {
          const fromSide = dep.type === 'SS' ? 'left' : 'right';
          const toSide = dep.type === 'FF' ? 'right' : 'left';

          const fromPos = getAnchorPos(dep.fromTaskId, fromSide);
          const toPos = getAnchorPos(dep.toTaskId, toSide);

          if (!fromPos || !toPos) return null;

          const isRelatedToSelected =
            dep.fromTaskId === selectedTaskId || dep.toTaskId === selectedTaskId;
          const isCritical =
            criticalTaskIds.has(dep.fromTaskId) && criticalTaskIds.has(dep.toTaskId);

          const strokeColor = isCritical
            ? '#E11D48'
            : isRelatedToSelected
            ? '#00A9E0'
            : '#0066B3';
          const strokeWidth = isRelatedToSelected ? 3.0 : isCritical ? 2.5 : 2.0;
          const markerUrl = isCritical
            ? 'url(#dep-arrow-critical)'
            : isRelatedToSelected
            ? 'url(#dep-arrow-active)'
            : 'url(#dep-arrow)';

          const { path: pathData, midX, midY } = calculateBezier(
            fromPos.x,
            fromPos.y,
            toPos.x,
            toPos.y,
            fromSide,
            toSide
          );

          return (
            <g key={dep.id} className="pointer-events-auto group">
              {/* Wider transparent hit zone for easy hover / click */}
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                className="cursor-pointer"
                onClick={() => onDeleteDependency(dep.id)}
              >
                <title>{`Dependency ${dep.type}${dep.lag ? ` +${dep.lag}d` : ''} (Click to delete)`}</title>
              </path>

              {/* Visual bezier line */}
              <path
                d={pathData}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dep.type !== 'FS' ? '5 3' : undefined}
                markerEnd={markerUrl}
                className="transition-all duration-150 group-hover:stroke-amber-500 group-hover:stroke-[3.5px]"
              />

              {/* Relationship badge positioned at exact mathematical midpoint of bezier */}
              <g
                transform={`translate(${midX}, ${midY})`}
                className="cursor-pointer"
                onClick={() => onDeleteDependency(dep.id)}
              >
                <rect
                  x="-14"
                  y="-9"
                  width="28"
                  height="18"
                  rx="4"
                  fill="#FFFFFF"
                  stroke={isRelatedToSelected ? '#00A9E0' : strokeColor}
                  strokeWidth="1.5"
                  className="group-hover:fill-rose-50 group-hover:stroke-rose-600 shadow-sm transition-colors"
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill={strokeColor}
                  fontSize="10"
                  fontFamily="'Inter', system-ui, sans-serif"
                  fontWeight="bold"
                  className="group-hover:hidden select-none pointer-events-none"
                >
                  {dep.type}
                </text>
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#E11D48"
                  fontSize="11"
                  fontWeight="bold"
                  className="hidden group-hover:block select-none pointer-events-none"
                >
                  ✕
                </text>
              </g>
            </g>
          );
        })}

        {/* Render live line while user is dragging connection from Miro dot */}
        {draggingConn && (() => {
          const fromPos = getAnchorPos(draggingConn.fromTaskId, draggingConn.fromSide);
          if (!fromPos) return null;

          const targetX = draggingConn.currentX;
          const targetY = draggingConn.currentY;

          const { path: pathData } = calculateBezier(
            fromPos.x,
            fromPos.y,
            targetX,
            targetY,
            draggingConn.fromSide,
            'left'
          );

          return (
            <g className="pointer-events-none">
              <path
                d={pathData}
                fill="none"
                stroke="#00A9E0"
                strokeWidth={3}
                strokeDasharray="6 4"
                markerEnd="url(#dep-arrow-active)"
                className="animate-pulse"
              />
              <circle
                cx={targetX}
                cy={targetY}
                r={6}
                fill="#00A9E0"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </g>
          );
        })()}
      </g>
    </svg>
  );
};
