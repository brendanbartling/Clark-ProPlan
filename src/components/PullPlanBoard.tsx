import React, { useRef, useState, useMemo } from 'react';
import {
  PullPlanProject,
  StickyNote,
  DependencyType,
  DraggingConnection,
} from '../types';
import { StickyNoteComponent } from './StickyNoteComponent';
import { DependencyOverlay, TaskCanvasPosition } from './DependencyOverlay';
import { calculateWorkDate, calculateDayFromDate } from '../utils/p6Format';
import { calculateDragSnap, LaneBoundary } from '../utils/dragMath';
import {
  packLaneTasks,
  PositionedTask,
  TRACK_HEIGHT,
  TRACK_GAP,
  LANE_PADDING_TOP,
  LANE_PADDING_BOTTOM,
} from '../utils/packing';
import {
  Plus,
  Trash2,
  Layers,
  Flag,
} from 'lucide-react';

interface ActiveDragTask {
  task: StickyNote;
  currentClientX: number;
  currentClientY: number;
  grabOffsetX: number;
  startClientX: number;
  startClientY: number;
  hasMoved: boolean;
  previewDay: number;
  previewLaneId: string;
  previewSlotIndex: number;
}

interface PullPlanBoardProps {
  project: PullPlanProject;
  selectedTaskId: string | null;
  selectedTradeFilter: string | null;
  criticalTaskIds: Set<string>;
  autoLinkEnabled: boolean;
  onSelectTask: (task: StickyNote) => void;
  onUpdateTaskName: (taskId: string, newName: string) => void;
  onAddTaskAtCell: (laneId: string, day: number) => void;
  onMoveTask: (taskId: string, targetLaneId: string, targetDay: number, targetSlotIndex?: number) => void;
  onResizeTaskDuration: (taskId: string, newDuration: number) => void;
  onAddDependency: (fromTaskId: string, toTaskId: string, type: DependencyType, lag?: number) => void;
  onDeleteDependency: (depId: string) => void;
  onAddLane: () => void;
  onDeleteLane: (laneId: string) => void;
  onUpdateLane: (laneId: string, name: string, wbsCode: string) => void;
  onAddDays: () => void;
}

export const PullPlanBoard: React.FC<PullPlanBoardProps> = ({
  project,
  selectedTaskId,
  selectedTradeFilter,
  criticalTaskIds,
  autoLinkEnabled,
  onSelectTask,
  onUpdateTaskName,
  onAddTaskAtCell,
  onMoveTask,
  onResizeTaskDuration,
  onAddDependency,
  onDeleteDependency,
  onAddLane,
  onDeleteLane,
  onUpdateLane,
  onAddDays,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const laneBoundariesRef = useRef<LaneBoundary[]>([]);

  // Dragging task state
  const [draggingTask, setDraggingTask] = useState<ActiveDragTask | null>(null);

  // Miro-style connection dragging state
  const [draggingConn, setDraggingConn] = useState<DraggingConnection | null>(null);

  // Dynamic row track height and milestone diamond sizing: scales with zoom level
  const zoomFactor = project.dayWidth / 145;
  const trackHeight = Math.max(76, Math.min(112, Math.round(TRACK_HEIGHT * Math.sqrt(zoomFactor))));
  const cardHeight = trackHeight - 4;
  // Diamond milestone matches the height of the row, scaling with zoom amount, bounded by column width
  const diamondSize = Math.max(48, Math.min(cardHeight, project.dayWidth - 12));

  // Target date marker calculation
  const targetDay = useMemo(() => {
    if (!project.targetDate) return null;
    return calculateDayFromDate(project.startDate, project.targetDate, project.workWeek);
  }, [project.startDate, project.targetDate, project.workWeek]);

  // Compute lane layouts & task canvas coordinates for multiple lines
  const { laneLayouts, laneBoundaries, taskPositions, totalContentHeight } = useMemo(() => {
    const layouts = new Map<
      string,
      { positionedTasks: PositionedTask[]; trackCount: number; laneHeight: number; laneTop: number }
    >();
    const boundaries: LaneBoundary[] = [];
    const positions = new Map<string, TaskCanvasPosition>();

    const HEADER_HEIGHT = 56;
    let currentTop = HEADER_HEIGHT;

    project.lanes.forEach((lane) => {
      let laneTasks = project.tasks.filter((t) => t.laneId === lane.id);

      // If a task is being dragged, update its position dynamically in the layout
      if (draggingTask && draggingTask.hasMoved) {
        if (lane.id === draggingTask.previewLaneId) {
          const existing = laneTasks.find((t) => t.id === draggingTask.task.id);
          if (existing) {
            laneTasks = laneTasks.map((t) =>
              t.id === draggingTask.task.id
                ? { ...t, day: draggingTask.previewDay, slotIndex: draggingTask.previewSlotIndex }
                : t
            );
          } else {
            laneTasks = [
              ...laneTasks,
              {
                ...draggingTask.task,
                laneId: lane.id,
                day: draggingTask.previewDay,
                slotIndex: draggingTask.previewSlotIndex,
              },
            ];
          }
        } else if (lane.id === draggingTask.task.laneId) {
          laneTasks = laneTasks.filter((t) => t.id !== draggingTask.task.id);
        }
      }

      const { positionedTasks, trackCount, laneHeight } = packLaneTasks(laneTasks, trackHeight);

      layouts.set(lane.id, {
        positionedTasks,
        trackCount,
        laneHeight,
        laneTop: currentTop,
      });

      boundaries.push({
        id: lane.id,
        top: currentTop,
        bottom: currentTop + laneHeight,
      });

      // Calculate canvas positions for every task
      positionedTasks.forEach((task) => {
        const isDiamond = task.shape === 'diamond';
        const taskWidth = isDiamond ? diamondSize : Math.max(90, task.duration * project.dayWidth - 12);
        const taskHeight = isDiamond ? diamondSize : cardHeight;
        const taskX = isDiamond
          ? 256 + (task.day - 1) * project.dayWidth + (project.dayWidth - diamondSize) / 2
          : 256 + (task.day - 1) * project.dayWidth + 6;
        const taskY =
          currentTop +
          LANE_PADDING_TOP +
          task.trackIndex * (trackHeight + TRACK_GAP) +
          (trackHeight - taskHeight) / 2;

        positions.set(task.id, {
          x: taskX,
          y: taskY,
          width: taskWidth,
          height: taskHeight,
        });
      });

      currentTop += laneHeight;
    });

    laneBoundariesRef.current = boundaries;

    return {
      laneLayouts: layouts,
      laneBoundaries: boundaries,
      taskPositions: positions,
      totalContentHeight: currentTop,
    };
  }, [project.lanes, project.tasks, project.dayWidth, draggingTask, diamondSize, trackHeight, cardHeight]);

  // Pointer-down drag handler with capture-phase release
  const handleCardPointerDown = (task: StickyNote, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const cardRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabOffsetX = e.clientX - cardRect.left;
    const pointerId = e.pointerId;
    const targetElement = e.currentTarget as HTMLElement;

    try {
      targetElement.setPointerCapture?.(pointerId);
    } catch {
      // Safe ignore
    }

    document.body.style.userSelect = 'none';

    let hasMoved = false;
    let currentPreviewDay = task.day;
    let currentPreviewLaneId = task.laneId;
    let currentPreviewSlotIndex = task.slotIndex ?? 0;

    setDraggingTask({
      task,
      currentClientX: startClientX,
      currentClientY: startClientY,
      grabOffsetX,
      startClientX,
      startClientY,
      hasMoved: false,
      previewDay: task.day,
      previewLaneId: task.laneId,
      previewSlotIndex: currentPreviewSlotIndex,
    });

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.buttons === 0) {
        onPointerUp();
        return;
      }

      const dist = Math.hypot(
        moveEvent.clientX - startClientX,
        moveEvent.clientY - startClientY
      );
      if (dist > 3) {
        hasMoved = true;
      }

      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const scrollTop = containerRef.current.scrollTop;

      const snap = calculateDragSnap(
        moveEvent.clientX,
        moveEvent.clientY,
        grabOffsetX,
        containerRect.left,
        containerRect.top,
        scrollLeft,
        scrollTop,
        project.dayWidth,
        project.totalDays,
        task.duration,
        laneBoundariesRef.current,
        256,
        trackHeight
      );

      currentPreviewDay = snap.day;
      currentPreviewLaneId = snap.laneId;
      currentPreviewSlotIndex = snap.slotIndex;

      setDraggingTask({
        task,
        currentClientX: moveEvent.clientX,
        currentClientY: moveEvent.clientY,
        grabOffsetX,
        startClientX,
        startClientY,
        hasMoved,
        previewDay: snap.day,
        previewLaneId: snap.laneId,
        previewSlotIndex: snap.slotIndex,
      });
    };

    const onPointerUp = () => {
      document.body.style.userSelect = '';
      try {
        if (targetElement && targetElement.hasPointerCapture?.(pointerId)) {
          targetElement.releasePointerCapture?.(pointerId);
        }
      } catch {
        // Safe ignore
      }

      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('mouseup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('blur', onPointerUp, true);

      // ALWAYS release dragging state immediately!
      setDraggingTask(null);

      if (hasMoved) {
        onMoveTask(task.id, currentPreviewLaneId, currentPreviewDay, currentPreviewSlotIndex);
      } else {
        // Pure click without moving
        onSelectTask(task);
      }
    };

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('mouseup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('blur', onPointerUp, true);
  };

  // Connection dragging handlers
  const handleStartConnectionDrag = (
    taskId: string,
    side: 'left' | 'right',
    startX: number,
    startY: number
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = startX - rect.left + containerRef.current.scrollLeft;
    const canvasY = startY - rect.top + containerRef.current.scrollTop;

    setDraggingConn({
      fromTaskId: taskId,
      fromSide: side,
      currentX: canvasX,
      currentY: canvasY,
    });
  };

  const handleMouseMoveConnection = (e: React.MouseEvent) => {
    if (!draggingConn || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left + containerRef.current.scrollLeft;
    const canvasY = e.clientY - rect.top + containerRef.current.scrollTop;

    setDraggingConn((prev) =>
      prev
        ? {
            ...prev,
            currentX: canvasX,
            currentY: canvasY,
          }
        : null
    );
  };

  const handleMouseUpConnection = () => {
    if (draggingConn) {
      setDraggingConn(null);
    }
  };

  const handleCompleteConnection = (targetTaskId: string) => {
    if (!draggingConn) return;
    if (draggingConn.fromTaskId === targetTaskId) {
      setDraggingConn(null);
      return;
    }

    if (draggingConn.fromSide === 'right') {
      onAddDependency(draggingConn.fromTaskId, targetTaskId, 'FS', 0);
    } else {
      onAddDependency(targetTaskId, draggingConn.fromTaskId, 'FS', 0);
    }

    setDraggingConn(null);
  };

  const tradeMap = new Map(project.trades.map((t) => [t.id, t]));
  const days = Array.from({ length: project.totalDays }, (_, i) => i + 1);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden bg-white relative select-none font-sans"
      onMouseMove={handleMouseMoveConnection}
      onMouseUp={handleMouseUpConnection}
    >
      {/* Scrollable Pull Plan Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto relative focus:outline-none bg-white"
      >
        {/* Board Content */}
        <div
          className="relative min-w-max flex flex-col bg-white"
          style={{
            paddingBottom: selectedTaskId ? '180px' : '60px',
            paddingRight: selectedTaskId ? '400px' : '40px',
            minHeight: `${totalContentHeight + 100}px`,
          }}
        >
          {/* Top Timeline Header Bar - Clean date and DOW ONLY (No Day 1, 2, 3...) */}
          <div className="sticky top-0 z-40 flex bg-slate-100 border-b-2 border-slate-300">
            {/* Swimlane Column Title Header */}
            <div className="sticky left-0 z-50 w-64 bg-slate-100 border-r-2 border-slate-300 p-2.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0066B3]" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                  Locations & Zones
                </span>
              </div>
              <button
                type="button"
                onClick={onAddLane}
                className="p-1 rounded bg-white hover:bg-slate-200 text-[#0066B3] hover:text-[#001430] border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Add new swimlane / location"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Zone</span>
              </button>
            </div>

            {/* Time Columns Header: ONLY Day of Week & Date */}
            <div className="flex bg-slate-100 relative">
              {days.map((day) => {
                const dateStr = calculateWorkDate(project.startDate, day, project.workWeek);
                const dateObj = new Date(dateStr + 'T00:00:00');
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const monthDay = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                const isStartOfWeek = day % (project.workWeek || 5) === 1;

                return (
                  <div
                    key={day}
                    className={`flex flex-col items-center justify-center border-r border-slate-300 py-2 select-none flex-shrink-0 transition-colors ${
                      isStartOfWeek ? 'border-l-2 border-l-[#00A9E0] bg-slate-200/60' : 'bg-slate-100'
                    }`}
                    style={{ width: `${project.dayWidth}px` }}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <span className="text-xs font-extrabold text-[#0066B3] font-sans uppercase tracking-wider">
                        {dayName}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        {monthDay}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Add more days button at the end of timeline */}
              <button
                type="button"
                onClick={onAddDays}
                className="w-16 border-r border-slate-300 bg-slate-100 hover:bg-slate-200 flex flex-col items-center justify-center text-slate-600 hover:text-[#0066B3] cursor-pointer transition-colors"
                title="Extend timeline by 5 days"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] font-bold">+5 Days</span>
              </button>
            </div>
          </div>

          {/* Swimlanes Body */}
          <div className="relative flex flex-col bg-white">
            {/* Target Date Vertical Red Line across all swimlanes */}
            {targetDay !== null && targetDay >= 1 && targetDay <= project.totalDays + 1 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-25 flex flex-col items-center"
                style={{
                  left: `${256 + (targetDay - 1) * project.dayWidth}px`,
                }}
              >
                {/* Header Flag Badge */}
                <div className="sticky top-1 -translate-y-8 bg-red-600 text-white font-mono font-black text-[10px] px-2 py-0.5 rounded shadow-lg border border-white flex items-center gap-1 whitespace-nowrap z-40">
                  <Flag className="w-3 h-3 fill-white" />
                  <span>TARGET: {project.targetDate}</span>
                </div>
                {/* Full Height Vertical Red Line */}
                <div className="w-0.5 h-full bg-red-600 border-r border-red-500 shadow-md opacity-95" />
              </div>
            )}

            {project.lanes.map((lane, laneIdx) => {
              const layout = laneLayouts.get(lane.id);
              const laneHeight = layout?.laneHeight || 104;
              const trackCount = layout?.trackCount || 1;
              const positionedTasks = layout?.positionedTasks || [];
              const isTargetLane = draggingTask?.previewLaneId === lane.id && draggingTask.hasMoved;

              return (
                <div
                  key={lane.id}
                  className={`flex border-b-2 border-slate-200 group/lane relative bg-white transition-colors ${
                    isTargetLane ? 'bg-blue-50/25' : ''
                  }`}
                  style={{ minHeight: `${laneHeight}px` }}
                >
                  {/* Left Sticky Lane Header */}
                  <div
                    className="sticky left-0 z-30 w-64 bg-slate-100 border-r-2 border-slate-300 p-3 flex flex-col justify-between flex-shrink-0"
                    style={{ minHeight: `${laneHeight}px` }}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={lane.wbsCode}
                          onChange={(e) =>
                            onUpdateLane(lane.id, lane.name, e.target.value)
                          }
                          className="font-mono text-xs font-bold text-[#0066B3] bg-transparent hover:bg-white px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 focus:outline-none focus:bg-white w-24"
                          title="WBS Code"
                        />
                        <div className="flex items-center gap-1">
                          {trackCount > 1 && (
                            <span
                              className="text-[10px] font-bold bg-[#00A9E0]/15 text-[#0066B3] px-1.5 py-0.5 rounded border border-[#00A9E0]/30"
                              title={`${trackCount} concurrent lines of work in this location`}
                            >
                              {trackCount} Lines
                            </span>
                          )}
                          <span className="text-[10px] font-bold bg-white text-slate-700 px-1.5 py-0.5 rounded border border-slate-300">
                            {positionedTasks.length} {positionedTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      </div>

                      {/* LOCATION / SWIMLANE NAME */}
                      <input
                        type="text"
                        value={lane.name}
                        onChange={(e) =>
                          onUpdateLane(lane.id, e.target.value, lane.wbsCode)
                        }
                        className="text-sm md:text-base font-bold text-slate-900 font-sans bg-transparent hover:bg-white px-1.5 py-1 rounded border border-transparent hover:border-slate-300 focus:outline-none focus:bg-white w-full tracking-tight"
                        title="Click to rename location / swimlane"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-xs text-slate-500 font-sans">
                      <span>Location #{laneIdx + 1}</span>
                      {project.lanes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteLane(lane.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded opacity-0 group-hover/lane:opacity-100 transition-opacity cursor-pointer"
                          title="Delete swimlane"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Day Grid Cells for this Swimlane */}
                  <div
                    className="flex relative bg-white"
                    style={{ minHeight: `${laneHeight}px` }}
                  >
                    {/* Render grid vertical day lines */}
                    {days.map((day) => {
                      const isStartOfWeek = day % (project.workWeek || 5) === 1;
                      return (
                        <div
                          key={day}
                          onClick={() => {
                            if (!draggingTask) {
                              onAddTaskAtCell(lane.id, day);
                            }
                          }}
                          className={`relative border-r border-slate-200/80 p-1 transition-colors group/cell cursor-pointer ${
                            isStartOfWeek ? 'border-l-2 border-l-[#00A9E0]/30 bg-slate-50/60' : 'bg-white'
                          } hover:bg-[#00A9E0]/5`}
                          style={{
                            width: `${project.dayWidth}px`,
                            minHeight: `${laneHeight}px`,
                          }}
                          title={`Day ${day} - ${lane.name}. Click to add activity.`}
                        >
                          <div className="opacity-0 group-hover/cell:opacity-60 transition-opacity pointer-events-none flex items-center justify-center pt-2 text-[11px] font-bold text-[#0066B3] font-sans">
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Placeholder space for extra days column */}
                    <div className="w-16 border-r border-slate-200 bg-slate-50/40" />

                    {/* Snap Preview Box while dragging (Respects vertical slot: above, below, or between) */}
                    {isTargetLane && draggingTask && (
                      <div
                        className="absolute z-5 pointer-events-none rounded border-2 border-dashed border-[#0066B3] bg-[#00A9E0]/20 flex items-center justify-center transition-all duration-75"
                        style={{
                          left: `${(draggingTask.previewDay - 1) * project.dayWidth + 6}px`,
                          top: `${LANE_PADDING_TOP + (draggingTask.previewSlotIndex || 0) * (trackHeight + TRACK_GAP) + (trackHeight - cardHeight) / 2}px`,
                          width: `${Math.max(90, draggingTask.task.duration * project.dayWidth - 12)}px`,
                          height: `${cardHeight}px`,
                        }}
                      >
                        <span className="text-xs font-bold text-[#001430] bg-white px-2 py-0.5 rounded font-sans border border-[#0066B3]/40">
                          Day {draggingTask.previewDay} (Slot {(draggingTask.previewSlotIndex || 0) + 1})
                        </span>
                      </div>
                    )}

                    {/* Positioned Sticky Notes */}
                    {positionedTasks.map((task) => {
                      const isFiltered =
                        selectedTradeFilter && task.tradeId !== selectedTradeFilter;
                      if (isFiltered) return null;

                      const isDiamond = task.shape === 'diamond';
                      // Center diamond sticky on the day column so zooming in/out never displaces it
                      const leftPx = isDiamond
                        ? (task.day - 1) * project.dayWidth + (project.dayWidth - diamondSize) / 2
                        : (task.day - 1) * project.dayWidth + 6;
                      const topPx =
                        LANE_PADDING_TOP +
                        task.trackIndex * (trackHeight + TRACK_GAP) +
                        (trackHeight - (isDiamond ? diamondSize : cardHeight)) / 2;

                      const isBeingMoved = draggingTask?.task.id === task.id && draggingTask.hasMoved;

                      return (
                        <div
                          key={task.id}
                          className="absolute z-10"
                          style={{
                            left: `${leftPx}px`,
                            top: `${topPx}px`,
                          }}
                        >
                          <StickyNoteComponent
                            task={task}
                            trade={tradeMap.get(task.tradeId)}
                            dayWidth={project.dayWidth}
                            cardHeight={cardHeight}
                            diamondSize={diamondSize}
                            isSelected={selectedTaskId === task.id}
                            isCritical={criticalTaskIds.has(task.id)}
                            isBeingDragged={isBeingMoved}
                            onSelect={onSelectTask}
                            onUpdateName={onUpdateTaskName}
                            onStartConnectionDrag={handleStartConnectionDrag}
                            onCompleteConnection={handleCompleteConnection}
                            onResizeDuration={onResizeTaskDuration}
                            onCardPointerDown={handleCardPointerDown}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* SVG Dependency Overlay */}
          <DependencyOverlay
            dependencies={project.dependencies}
            tasks={project.tasks}
            selectedTaskId={selectedTaskId}
            criticalTaskIds={criticalTaskIds}
            draggingConn={draggingConn}
            taskPositions={taskPositions}
            onDeleteDependency={onDeleteDependency}
          />
        </div>
      </div>

      {/* Floating Ghost Card attached to cursor while dragging (ZERO SHADOWS, FLAT) */}
      {draggingTask && draggingTask.hasMoved && (
        <div
          className="fixed pointer-events-none z-50 transition-none"
          style={{
            left: `${draggingTask.currentClientX - draggingTask.grabOffsetX}px`,
            top: `${draggingTask.currentClientY - 35}px`,
            width: `${Math.max(90, draggingTask.task.duration * project.dayWidth - 12)}px`,
            opacity: 0.95,
          }}
        >
          <div
            className="rounded-md p-3 border-2 border-[#001430] flex items-center justify-center text-center"
            style={{
              minHeight: '84px',
              backgroundColor: tradeMap.get(draggingTask.task.tradeId)?.color || '#00A9E0',
              color: tradeMap.get(draggingTask.task.tradeId)?.textColor || '#FFFFFF',
            }}
          >
            <p className="text-sm font-bold font-sans line-clamp-3 leading-snug">
              {draggingTask.task.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
