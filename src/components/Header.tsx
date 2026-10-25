import React, { useRef } from 'react';
import { PullPlanProject, TimescaleMode } from '../types';
import { CompanyLogo } from './CompanyLogo';
import {
  FileSpreadsheet,
  Upload,
  Printer,
  Download,
  Plus,
  Palette,
  Route,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Calendar,
  Flag,
} from 'lucide-react';

interface HeaderProps {
  project: PullPlanProject;
  selectedTradeFilter: string | null;
  autoLinkEnabled: boolean;
  criticalPathEnabled: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateProjectNumber: (projectNumber: string) => void;
  onUpdateStartDate: (startDate: string) => void;
  onUpdateEndDate: (endDate: string) => void;
  onUpdateTargetDate: (targetDate: string | undefined) => void;
  onUpdateWorkWeek: (workWeek: 5 | 6 | 7) => void;
  onUpdateTimescale: (timescale: TimescaleMode) => void;
  onUpdateLogo: (logoUrl?: string) => void;
  onAddStickyQuick: () => void;
  onToggleAutoLink: () => void;
  onToggleCriticalPath: () => void;
  onSelectTradeFilter: (tradeId: string | null) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExportP6: () => void;
  onImportP6: (file: File) => void;
  onOpenPdfModal: () => void;
  onOpenTradeManager: () => void;
  onSaveLocalJson: () => void;
  onLoadLocalJson: (file: File) => void;
  onResetSample: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  selectedTradeFilter,
  autoLinkEnabled,
  criticalPathEnabled,
  onUpdateTitle,
  onUpdateProjectNumber,
  onUpdateStartDate,
  onUpdateEndDate,
  onUpdateTargetDate,
  onUpdateWorkWeek,
  onUpdateTimescale,
  onUpdateLogo,
  onAddStickyQuick,
  onToggleAutoLink,
  onToggleCriticalPath,
  onSelectTradeFilter,
  onZoomIn,
  onZoomOut,
  onExportP6,
  onImportP6,
  onOpenPdfModal,
  onOpenTradeManager,
  onSaveLocalJson,
  onLoadLocalJson,
  onResetSample,
}) => {
  const p6FileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleP6FileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportP6(file);
      e.target.value = '';
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadLocalJson(file);
      e.target.value = '';
    }
  };

  return (
    <header
      className="relative z-50 border-b-2 border-[#0066B3]/40 px-3 py-2 flex flex-col xl:flex-row items-center justify-between gap-2.5 select-none no-print font-sans shadow-md"
      style={{ backgroundColor: '#001430' }} // Clark Primary Navy color distinct from white background
    >
      {/* Hidden file inputs */}
      <input
        ref={p6FileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleP6FileChange}
        className="hidden"
        aria-label="Upload P6 Excel file"
      />
      <input
        ref={jsonFileInputRef}
        type="file"
        accept=".json,.pullplan"
        onChange={handleJsonFileChange}
        className="hidden"
        aria-label="Upload Project JSON"
      />

      {/* Left Section: Company Logo + Project Title & Project # + Schedule Controls */}
      <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
        {/* Company Logo Container */}
        <CompanyLogo
          customLogoUrl={project.logoUrl}
          onUpdateLogo={onUpdateLogo}
        />

        {/* Project Title & Project # */}
        <div className="flex flex-col min-w-0">
          <input
            type="text"
            value={project.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="text-sm md:text-base font-black text-white bg-transparent hover:bg-white/10 focus:bg-white/15 border border-transparent hover:border-white/20 focus:border-[#00A9E0] rounded px-2 py-0.5 focus:outline-none truncate max-w-xs md:max-w-sm tracking-tight font-sans"
            title="Click to edit project title"
          />
          <div className="flex items-center gap-1.5 px-1 text-xs text-slate-300 font-mono">
            <span className="font-semibold text-slate-400">#</span>
            <input
              type="text"
              value={project.projectNumber}
              onChange={(e) => onUpdateProjectNumber(e.target.value)}
              className="text-[#00A9E0] font-black bg-transparent hover:bg-white/10 focus:bg-white/15 border border-transparent hover:border-white/20 focus:border-[#00A9E0] rounded px-1 py-0 focus:outline-none w-24"
              title="Click to edit project number"
            />
            <span className="text-slate-500">|</span>
            <span className="text-slate-300 font-medium">
              {project.tasks.length} Activities
            </span>
          </div>
        </div>

        {/* Work Week Selector (5, 6, 7 Days) */}
        <div
          className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs font-bold text-slate-300"
          title="Select Work Week Schedule"
        >
          <span className="px-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Week:
          </span>
          <button
            type="button"
            onClick={() => onUpdateWorkWeek(5)}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
              project.workWeek === 5
                ? 'bg-[#00A9E0] text-white font-black'
                : 'hover:text-white hover:bg-white/10'
            }`}
            title="5-Day Work Week (Mon - Fri, skips weekends)"
          >
            5d
          </button>
          <button
            type="button"
            onClick={() => onUpdateWorkWeek(6)}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
              project.workWeek === 6
                ? 'bg-[#00A9E0] text-white font-black'
                : 'hover:text-white hover:bg-white/10'
            }`}
            title="6-Day Work Week (Mon - Sat, skips Sunday)"
          >
            6d
          </button>
          <button
            type="button"
            onClick={() => onUpdateWorkWeek(7)}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
              project.workWeek === 7
                ? 'bg-[#00A9E0] text-white font-black'
                : 'hover:text-white hover:bg-white/10'
            }`}
            title="7-Day Work Week (All calendar days)"
          >
            7d
          </button>
        </div>

        {/* Timescale Selector (Daily, Weekly, Monthly) */}
        <div
          className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs font-bold text-slate-300"
          title="Switch Timeline Timescale (Daily, Weekly, Monthly)"
        >
          <span className="px-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            Scale:
          </span>
          <button
            type="button"
            onClick={() => onUpdateTimescale('daily')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
              (project.timescale || 'daily') === 'daily'
                ? 'bg-[#00A9E0] text-white font-black shadow-xs'
                : 'hover:text-white hover:bg-white/10'
            }`}
            title="Daily timescale view (Day by day)"
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => onUpdateTimescale('weekly')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
              project.timescale === 'weekly'
                ? 'bg-[#00A9E0] text-white font-black shadow-xs'
                : 'hover:text-white hover:bg-white/10'
            }`}
            title="Weekly timescale view (Work weeks)"
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => onUpdateTimescale('monthly')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors text-xs ${
              project.timescale === 'monthly'
                ? 'bg-[#00A9E0] text-white font-black shadow-xs'
                : 'hover:text-white hover:bg-white/10'
            }`}
            title="Monthly timescale view (Project overview)"
          >
            Monthly
          </button>
        </div>

        {/* Start Date & End Date Controls (Auto-generate NTP MILE-010 & Substantial Completion MILE-110) */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 font-mono">
          <Calendar className="w-3.5 h-3.5 text-[#00A9E0] flex-shrink-0" />
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-sans font-semibold text-[11px]">Start:</span>
            <input
              type="date"
              value={project.startDate}
              onChange={(e) => onUpdateStartDate(e.target.value)}
              className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
              title="Project Start Date (Auto-syncs NTP MILE-010 milestone)"
            />
          </div>
          <span className="text-slate-500">→</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-sans font-semibold text-[11px]">End:</span>
            <input
              type="date"
              value={project.endDate || ''}
              onChange={(e) => onUpdateEndDate(e.target.value)}
              className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
              title="Project End Date (Auto-syncs Substantial Completion MILE-110 milestone)"
            />
          </div>
        </div>

        {/* Target Date Picker (Creates Red Line on Chart) */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 font-mono">
          <Flag className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <span className="text-rose-400 font-sans font-bold text-[11px]">Target:</span>
          <input
            type="date"
            value={project.targetDate || ''}
            onChange={(e) => onUpdateTargetDate(e.target.value || undefined)}
            className="bg-transparent text-rose-300 font-mono text-xs focus:outline-none cursor-pointer"
            title="Set Target Date to show vertical red marker line on pull plan"
          />
          {project.targetDate && (
            <button
              type="button"
              onClick={() => onUpdateTargetDate(undefined)}
              className="text-slate-400 hover:text-white px-1 text-xs font-bold cursor-pointer"
              title="Clear Target Date line"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right Section: Action Controls */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 w-full xl:w-auto">
        {/* Quick Add Sticky Note (Minimize clicks) */}
        <button
          type="button"
          onClick={onAddStickyQuick}
          className="px-3 py-1.5 rounded-lg bg-[#00A9E0] hover:bg-[#0095c7] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#00A9E0]/30 cursor-pointer transition-transform hover:scale-102 font-sans"
          title="Click to quickly add a new sticky note"
        >
          <Plus className="w-4 h-4" />
          <span>Add Note</span>
        </button>

        {/* Auto Link Toggle */}
        <button
          type="button"
          onClick={onToggleAutoLink}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all font-sans ${
            autoLinkEnabled
              ? 'border-[#00A9E0] bg-[#00A9E0]/20 text-[#00A9E0]'
              : 'border-white/20 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title="When enabled, placing a sticky note automatically links it to the activity to its left"
        >
          <Zap className={`w-3.5 h-3.5 ${autoLinkEnabled ? 'fill-[#00A9E0]' : ''}`} />
          <span className="hidden sm:inline">Auto-Link</span>
        </button>

        {/* Critical Path Toggle */}
        <button
          type="button"
          onClick={onToggleCriticalPath}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all font-sans ${
            criticalPathEnabled
              ? 'border-rose-400 bg-rose-950/60 text-rose-300 ring-1 ring-rose-500'
              : 'border-white/20 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
          }`}
          title="Highlight Critical Path with bold red outline"
        >
          <Route className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Critical Path</span>
        </button>

        {/* Trade Filter Dropdown */}
        <div className="relative flex items-center">
          <select
            value={selectedTradeFilter || ''}
            onChange={(e) => onSelectTradeFilter(e.target.value || null)}
            className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00A9E0] cursor-pointer shadow-xs font-sans font-medium"
            title="Filter board by Trade"
          >
            <option value="">All Trades ({project.trades.length})</option>
            {project.trades.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.idPrefix || t.code}] {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Trade Color & ID Prefix Manager */}
        <button
          type="button"
          onClick={onOpenTradeManager}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer transition-colors shadow-xs"
          title="Manage Trades, ID Prefixes & Color Swatches"
        >
          <Palette className="w-4 h-4 text-[#00A9E0]" />
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            title="Zoom out timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono px-1.5 text-[#00A9E0] font-bold">
            {project.dayWidth}px
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            title="Zoom in timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* P6 XLSX Import / Export Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 shadow-xs">
          <button
            type="button"
            onClick={onExportP6}
            className="px-2 py-1 rounded bg-[#0066B3] hover:bg-[#005291] text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs font-sans"
            title="Export to Primavera P6 XLSX (TASK & TASKPRED sheets)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#00A9E0]" />
            <span className="hidden sm:inline">P6 XLSX</span>
          </button>
          <button
            type="button"
            onClick={() => p6FileInputRef.current?.click()}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
            title="Import from P6 or Excel XLSX file"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 11x17 PDF Export */}
        <button
          type="button"
          onClick={onOpenPdfModal}
          className="px-2.5 py-1.5 rounded-lg bg-[#0066B3]/60 hover:bg-[#0066B3] border border-[#00A9E0]/40 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs font-sans"
          title="Print or export 11x17 Landscape PDF Report"
        >
          <Printer className="w-3.5 h-3.5 text-[#00A9E0]" />
          <span className="hidden sm:inline">11x17 PDF</span>
        </button>

        {/* Local JSON Save / Load & Reset */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onSaveLocalJson}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-slate-300 hover:text-white cursor-pointer transition-colors shadow-xs"
            title="Save Project locally (.pullplan / .json)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => jsonFileInputRef.current?.click()}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-slate-300 hover:text-white cursor-pointer transition-colors shadow-xs"
            title="Load Project (.pullplan / .json)"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onResetSample}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-slate-400 hover:text-amber-400 cursor-pointer transition-colors shadow-xs"
            title="Reset to Clark Sample Pull Plan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
