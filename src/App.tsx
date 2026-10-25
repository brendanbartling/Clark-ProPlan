/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import {
  PullPlanProject,
  StickyNote,
  SwimLane,
  DependencyType,
  Dependency,
  TimescaleMode,
} from './types';
import { INITIAL_PROJECT } from './defaultData';
import { Header } from './components/Header';
import { PullPlanBoard } from './components/PullPlanBoard';
import { SidebarEditor } from './components/SidebarEditor';
import { FooterDependencies } from './components/FooterDependencies';
import { TradeManagerModal } from './components/TradeManagerModal';
import { PdfExportModal } from './components/PdfExportModal';
import { PrintReportView } from './components/PrintReportView';
import {
  handleLanePlacementDependencies,
  addOrUpdateDependency,
  removeDependency,
  updateDependency,
  getCriticalPathTaskIds,
} from './utils/dependencyLogic';
import {
  generateP6Workbook,
  parseP6OrExcelWorkbook,
  calculateTotalWorkDays,
  calculateWorkDate,
} from './utils/p6Format';
import { generateNextTaskId } from './utils/idGenerator';

const LOCAL_STORAGE_KEY = 'clark_pull_plan_project_v3';

/**
 * Ensures Notice to Proceed (MILE-010) on Day 1 and Substantial Completion (MILE-110) on Day totalDays
 */
function syncMilestones(
  tasks: StickyNote[],
  lanes: SwimLane[],
  totalDays: number
): StickyNote[] {
  const milestoneLaneId =
    lanes.find((l) => l.name.toLowerCase().includes('milestone'))?.id ||
    lanes[0]?.id ||
    'LANE-MILE';

  let updated = [...tasks];

  // NTP Milestone (MILE-010) on Day 1
  const ntpIndex = updated.findIndex((t) => t.id === 'MILE-010');
  if (ntpIndex >= 0) {
    updated[ntpIndex] = {
      ...updated[ntpIndex],
      day: 1,
      duration: 1,
      laneId: milestoneLaneId,
      shape: 'diamond',
    };
  } else {
    updated.unshift({
      id: 'MILE-010',
      name: 'Notice to Proceed (NTP)',
      tradeId: 'TRADE-GC',
      laneId: milestoneLaneId,
      day: 1,
      duration: 1,
      crewSize: 2,
      shape: 'diamond',
      status: 'complete',
      notes: 'Official contract notice to proceed milestone.',
    });
  }

  // Substantial Completion Milestone (MILE-110) on final day
  const subIndex = updated.findIndex((t) => t.id === 'MILE-110');
  if (subIndex >= 0) {
    updated[subIndex] = {
      ...updated[subIndex],
      day: totalDays,
      duration: 1,
      laneId: milestoneLaneId,
      shape: 'diamond',
    };
  } else {
    updated.push({
      id: 'MILE-110',
      name: 'Substantial Completion',
      tradeId: 'TRADE-GC',
      laneId: milestoneLaneId,
      day: totalDays,
      duration: 1,
      crewSize: 2,
      shape: 'diamond',
      status: 'planned',
      notes: 'Project substantial completion milestone.',
    });
  }

  return updated;
}

export default function App() {
  // Load from localStorage or initial realistic Clark Construction sample
  const [project, setProject] = useState<PullPlanProject>(() => {
    try {
      const savedStr = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved && Array.isArray(saved.tasks)) {
          const hasOldLanes = saved.lanes?.some(
            (l: any) => l.name?.includes('Sector A') || l.name?.includes('Pod')
          );
          if (hasOldLanes) {
            return INITIAL_PROJECT;
          }
          const workWeek = saved.workWeek || 5;
          const trades = saved.trades.map((t: any) => ({
            ...t,
            idPrefix: t.idPrefix || t.code || 'ACT',
          }));
          const endDate =
            saved.endDate || calculateWorkDate(saved.startDate, saved.totalDays, workWeek);
          const tasks = syncMilestones(saved.tasks, saved.lanes, saved.totalDays);
          return {
            ...saved,
            workWeek,
            timescale: saved.timescale || 'daily',
            trades,
            endDate,
            tasks,
          };
        }
      }
    } catch (e) {
      console.error('Error loading stored project:', e);
    }
    return INITIAL_PROJECT;
  });

  // Selected sticky note (opens both right sidebar and bottom footer simultaneously!)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Settings & Filters
  const [autoLinkEnabled, setAutoLinkEnabled] = useState(true);
  const [criticalPathEnabled, setCriticalPathEnabled] = useState(false);
  const [selectedTradeFilter, setSelectedTradeFilter] = useState<string | null>(null);

  // Modals
  const [isTradeManagerOpen, setIsTradeManagerOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(project));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }, [project]);

  // Selected Task object
  const selectedTask = useMemo(() => {
    return project.tasks.find((t) => t.id === selectedTaskId) || null;
  }, [project.tasks, selectedTaskId]);

  // Critical path calculation
  const criticalTaskIds = useMemo(() => {
    if (!criticalPathEnabled) return new Set<string>();
    return getCriticalPathTaskIds(project.tasks, project.dependencies);
  }, [project.tasks, project.dependencies, criticalPathEnabled]);

  // 1. Keyboard Shortcut: Hit Backspace or Delete to remove selected activity
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName;
        if (
          activeTag === 'INPUT' ||
          activeTag === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.isContentEditable
        ) {
          return;
        }
        if (selectedTaskId) {
          e.preventDefault();
          handleDeleteTask(selectedTaskId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId]);

  // 2. Quick Add Sticky Note (Single click / zero friction with Trade ID Prefix & Spacing by 10)
  const handleAddTaskAtCell = (laneId: string, day: number) => {
    // Pick trade (filter if active, else GC or first trade)
    const defaultTradeId =
      selectedTradeFilter || project.trades[0]?.id || 'TRADE-GC';
    const trade = project.trades.find((t) => t.id === defaultTradeId);

    // Auto-generate unique ID using trade prefix spaced by 10
    const newId = generateNextTaskId(trade, project.tasks);

    const newTask: StickyNote = {
      id: newId,
      name: 'New Activity',
      tradeId: defaultTradeId,
      laneId,
      day,
      duration: 2,
      crewSize: 4,
      shape: 'rectangle',
      status: 'planned',
      constraints: [],
    };

    let updatedDependencies = project.dependencies;
    if (autoLinkEnabled) {
      updatedDependencies = handleLanePlacementDependencies(
        newTask,
        project.tasks,
        project.dependencies
      );
    }

    setProject((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
      dependencies: updatedDependencies,
      updatedAt: new Date().toISOString(),
    }));

    // Auto-select newly created sticky note so user can immediately edit description
    setSelectedTaskId(newId);
  };

  const handleAddStickyQuick = () => {
    const firstLane = project.lanes[0]?.id || 'LANE-1';
    const laneTasks = project.tasks.filter((t) => t.laneId === firstLane);
    const maxDay = laneTasks.reduce((max, t) => Math.max(max, t.day + t.duration), 1);
    handleAddTaskAtCell(firstLane, Math.min(maxDay, project.totalDays - 2));
  };

  // 3. Move Sticky Note (With vertical above/below/between slot drop)
  const handleMoveTask = (
    taskId: string,
    targetLaneId: string,
    targetDay: number,
    targetSlotIndex?: number
  ) => {
    const existingTask = project.tasks.find((t) => t.id === taskId);
    if (!existingTask) return;

    const previousLaneId = existingTask.laneId;
    const updatedTask: StickyNote = {
      ...existingTask,
      laneId: targetLaneId,
      day: Math.max(1, targetDay),
      slotIndex: targetSlotIndex !== undefined ? targetSlotIndex : existingTask.slotIndex,
    };

    const remainingTasks = project.tasks.filter((t) => t.id !== taskId);
    const newTasksList = [...remainingTasks, updatedTask];

    let updatedDependencies = project.dependencies;
    if (autoLinkEnabled) {
      updatedDependencies = handleLanePlacementDependencies(
        updatedTask,
        newTasksList,
        project.dependencies,
        previousLaneId
      );
    }

    setProject((prev) => ({
      ...prev,
      tasks: newTasksList,
      dependencies: updatedDependencies,
      updatedAt: new Date().toISOString(),
    }));
  };

  // 4. Inline Double-Click Name Update
  const handleUpdateTaskName = (taskId: string, newName: string) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, name: newName } : t)),
      updatedAt: new Date().toISOString(),
    }));
  };

  // 5. Resize Sticky Note duration by dragging edge (snapping to day)
  const handleResizeTaskDuration = (taskId: string, newDuration: number) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, duration: Math.max(1, newDuration) } : t
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // 6. Update Sticky Note from Sidebar
  const handleUpdateTask = (updatedTask: StickyNote) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      updatedAt: new Date().toISOString(),
    }));
  };

  // 7. Delete Sticky Note
  const handleDeleteTask = (taskId: string) => {
    setProject((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      dependencies: prev.dependencies.filter(
        (d) => d.fromTaskId !== taskId && d.toTaskId !== taskId
      ),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedTaskId === taskId) {
      setSelectedTaskId(null);
    }
  };

  // 8. Duplicate Sticky Note (With unique trade prefix ID spaced by 10)
  const handleDuplicateTask = (taskToDup: StickyNote) => {
    const trade = project.trades.find((t) => t.id === taskToDup.tradeId);
    const newId = generateNextTaskId(trade, project.tasks);

    const dupTask: StickyNote = {
      ...taskToDup,
      id: newId,
      name: `${taskToDup.name} (Copy)`,
      day: Math.min(taskToDup.day + taskToDup.duration, project.totalDays - 1),
    };

    let updatedDependencies = project.dependencies;
    if (autoLinkEnabled) {
      updatedDependencies = handleLanePlacementDependencies(
        dupTask,
        project.tasks,
        project.dependencies
      );
    }

    setProject((prev) => ({
      ...prev,
      tasks: [...prev.tasks, dupTask],
      dependencies: updatedDependencies,
      updatedAt: new Date().toISOString(),
    }));

    setSelectedTaskId(newId);
  };

  // 9. Date Range and Milestones Auto-Generation
  const handleUpdateStartDate = (startDate: string) => {
    setProject((prev) => {
      let totalDays = prev.totalDays;
      if (prev.endDate) {
        totalDays = calculateTotalWorkDays(startDate, prev.endDate, prev.workWeek);
      }
      const syncedTasks = syncMilestones(prev.tasks, prev.lanes, totalDays);
      return {
        ...prev,
        startDate,
        totalDays,
        tasks: syncedTasks,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleUpdateEndDate = (endDate: string) => {
    setProject((prev) => {
      const totalDays = calculateTotalWorkDays(prev.startDate, endDate, prev.workWeek);
      const syncedTasks = syncMilestones(prev.tasks, prev.lanes, totalDays);
      return {
        ...prev,
        endDate,
        totalDays,
        tasks: syncedTasks,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleUpdateWorkWeek = (workWeek: 5 | 6 | 7) => {
    setProject((prev) => {
      let totalDays = prev.totalDays;
      if (prev.endDate) {
        totalDays = calculateTotalWorkDays(prev.startDate, prev.endDate, workWeek);
      }
      const syncedTasks = syncMilestones(prev.tasks, prev.lanes, totalDays);
      return {
        ...prev,
        workWeek,
        totalDays,
        tasks: syncedTasks,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleUpdateTargetDate = (targetDate: string | undefined) => {
    setProject((prev) => ({
      ...prev,
      targetDate,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleUpdateTimescale = (timescale: TimescaleMode) => {
    setProject((prev) => {
      let newDayWidth = prev.dayWidth;
      if (timescale === 'daily') {
        newDayWidth = 145;
      } else if (timescale === 'weekly') {
        newDayWidth = 72;
      } else if (timescale === 'monthly') {
        newDayWidth = 38;
      }
      return {
        ...prev,
        timescale,
        dayWidth: newDayWidth,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // 10. Dependencies Management
  const handleAddDependency = (
    fromTaskId: string,
    toTaskId: string,
    type: DependencyType = 'FS',
    lag: number = 0
  ) => {
    const updated = addOrUpdateDependency(
      project.dependencies,
      fromTaskId,
      toTaskId,
      type,
      lag
    );
    setProject((prev) => ({
      ...prev,
      dependencies: updated,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleRemoveDependency = (depId: string) => {
    const updated = removeDependency(project.dependencies, depId);
    setProject((prev) => ({
      ...prev,
      dependencies: updated,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleUpdateDependency = (
    depId: string,
    updates: Partial<Pick<Dependency, 'type' | 'lag'>>
  ) => {
    const updated = updateDependency(project.dependencies, depId, updates);
    setProject((prev) => ({
      ...prev,
      dependencies: updated,
      updatedAt: new Date().toISOString(),
    }));
  };

  // 11. Swimlane Management
  const handleAddLane = () => {
    const newNum = project.lanes.length + 1;
    const newLane: SwimLane = {
      id: `LANE-${Date.now()}`,
      name: `New Swim Lane ${newNum}`,
      wbsCode: `WBS-1.0${newNum}`,
      order: newNum,
    };
    setProject((prev) => ({
      ...prev,
      lanes: [...prev.lanes, newLane],
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteLane = (laneId: string) => {
    if (project.lanes.length <= 1) return;
    setProject((prev) => ({
      ...prev,
      lanes: prev.lanes.filter((l) => l.id !== laneId),
      tasks: prev.tasks.map((t) =>
        t.laneId === laneId
          ? { ...t, laneId: prev.lanes.find((l) => l.id !== laneId)?.id || 'LANE-1' }
          : t
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleUpdateLane = (laneId: string, name: string, wbsCode: string) => {
    setProject((prev) => ({
      ...prev,
      lanes: prev.lanes.map((l) => (l.id === laneId ? { ...l, name, wbsCode } : l)),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Extend timeline
  const handleAddDays = () => {
    setProject((prev) => {
      const newTotal = prev.totalDays + 5;
      const newEndDate = calculateWorkDate(prev.startDate, newTotal, prev.workWeek);
      const synced = syncMilestones(prev.tasks, prev.lanes, newTotal);
      return {
        ...prev,
        totalDays: newTotal,
        endDate: newEndDate,
        tasks: synced,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  // 12. P6 XLSX Export & Import
  const handleExportP6 = () => {
    try {
      const wb = generateP6Workbook(project);
      const fileName = `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_P6_Export.xlsx`;
      XLSX.writeFile(wb, fileName);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (e) {
      console.error('Error exporting P6 workbook:', e);
      alert('Could not export P6 file. Please check console for details.');
    }
  };

  const handleImportP6 = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseP6OrExcelWorkbook(buffer, project);
      const syncedTasks = syncMilestones(parsed.tasks, parsed.lanes, parsed.totalDays);
      setProject((prev) => ({
        ...prev,
        tasks: syncedTasks,
        lanes: parsed.lanes,
        trades: parsed.trades,
        dependencies: parsed.dependencies,
        totalDays: parsed.totalDays,
        endDate: calculateWorkDate(prev.startDate, parsed.totalDays, prev.workWeek),
        updatedAt: new Date().toISOString(),
      }));
      setSelectedTaskId(null);

      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      console.error('Error importing P6 file:', e);
      alert('Failed to parse Excel file. Ensure it contains a TASK or Activities sheet.');
    }
  };

  // 13. Local JSON Save / Load
  const handleSaveLocalJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${project.title.replace(/\s+/g, '_')}_pullplan.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleLoadLocalJson = async (file: File) => {
    try {
      const text = await file.text();
      const loadedProject = JSON.parse(text) as PullPlanProject;
      if (loadedProject && Array.isArray(loadedProject.tasks)) {
        setProject(loadedProject);
        setSelectedTaskId(null);
      }
    } catch (e) {
      console.error('Error loading JSON project:', e);
      alert('Invalid project JSON file.');
    }
  };

  // Reset to default sample
  const handleResetSample = () => {
    if (window.confirm('Reset board to Clark Construction sample pull plan?')) {
      setProject(INITIAL_PROJECT);
      setSelectedTaskId(null);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setProject((prev) => ({
      ...prev,
      dayWidth: Math.min(240, prev.dayWidth + 15),
    }));
  };

  const handleZoomOut = () => {
    setProject((prev) => ({
      ...prev,
      dayWidth: Math.max(90, prev.dayWidth - 15),
    }));
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white text-slate-900 font-sans">
      {/* Top Application Bar with Schedule and Milestone Settings */}
      <Header
        project={project}
        selectedTradeFilter={selectedTradeFilter}
        autoLinkEnabled={autoLinkEnabled}
        criticalPathEnabled={criticalPathEnabled}
        onUpdateTitle={(title) => setProject((p) => ({ ...p, title }))}
        onUpdateProjectNumber={(projectNumber) =>
          setProject((p) => ({ ...p, projectNumber }))
        }
        onUpdateStartDate={handleUpdateStartDate}
        onUpdateEndDate={handleUpdateEndDate}
        onUpdateTargetDate={handleUpdateTargetDate}
        onUpdateWorkWeek={handleUpdateWorkWeek}
        onUpdateTimescale={handleUpdateTimescale}
        onUpdateLogo={(logoUrl) => setProject((p) => ({ ...p, logoUrl }))}
        onAddStickyQuick={handleAddStickyQuick}
        onToggleAutoLink={() => setAutoLinkEnabled(!autoLinkEnabled)}
        onToggleCriticalPath={() => setCriticalPathEnabled(!criticalPathEnabled)}
        onSelectTradeFilter={setSelectedTradeFilter}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onExportP6={handleExportP6}
        onImportP6={handleImportP6}
        onOpenPdfModal={() => setIsPdfModalOpen(true)}
        onOpenTradeManager={() => setIsTradeManagerOpen(true)}
        onSaveLocalJson={handleSaveLocalJson}
        onLoadLocalJson={handleLoadLocalJson}
        onResetSample={handleResetSample}
      />

      {/* Main Pull Plan Interactive Grid */}
      <PullPlanBoard
        project={project}
        selectedTaskId={selectedTaskId}
        selectedTradeFilter={selectedTradeFilter}
        criticalTaskIds={criticalTaskIds}
        autoLinkEnabled={autoLinkEnabled}
        onSelectTask={(task) => setSelectedTaskId(task.id)}
        onUpdateTaskName={handleUpdateTaskName}
        onAddTaskAtCell={handleAddTaskAtCell}
        onMoveTask={handleMoveTask}
        onResizeTaskDuration={handleResizeTaskDuration}
        onAddDependency={handleAddDependency}
        onDeleteDependency={handleRemoveDependency}
        onAddLane={handleAddLane}
        onDeleteLane={handleDeleteLane}
        onUpdateLane={handleUpdateLane}
        onAddDays={handleAddDays}
      />

      {/* Sidebar Editor (Slides out from right when a sticky note is selected) */}
      {selectedTask && (
        <SidebarEditor
          task={selectedTask}
          trades={project.trades}
          lanes={project.lanes}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onDuplicate={handleDuplicateTask}
          onClose={() => setSelectedTaskId(null)}
          onOpenTradeManager={() => setIsTradeManagerOpen(true)}
        />
      )}

      {/* Footer Dependencies Dock (Pops out from bottom when a sticky note is selected) */}
      {selectedTask && (
        <FooterDependencies
          selectedTask={selectedTask}
          allTasks={project.tasks}
          trades={project.trades}
          dependencies={project.dependencies}
          onAddDependency={handleAddDependency}
          onRemoveDependency={handleRemoveDependency}
          onUpdateDependency={handleUpdateDependency}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Trade & Colors Manager Modal */}
      <TradeManagerModal
        isOpen={isTradeManagerOpen}
        trades={project.trades}
        onClose={() => setIsTradeManagerOpen(false)}
        onUpdateTrades={(trades) =>
          setProject((prev) => ({ ...prev, trades }))
        }
      />

      {/* 11x17 Landscape PDF Export Modal */}
      <PdfExportModal
        isOpen={isPdfModalOpen}
        project={project}
        onClose={() => setIsPdfModalOpen(false)}
      />

      {/* 11x17 Landscape Print View (Targeted by @media print) */}
      <PrintReportView project={project} />
    </div>
  );
}
