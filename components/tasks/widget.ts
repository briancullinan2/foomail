import { Widget } from '@lumino/widgets';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { LuminoMenuWindow, GlobalToolbarsWindow } from '../bundle/menu.d';
import { TasksSidebar } from './widget-sidebar';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

export interface TaskTask
{
	id: string;
	title: string;
	assignee: string;
	priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
	status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED';
	progress: number; // 0 - 100%
	startDate: string;
	dueDate: string;
	estimatedHours: number;
	isDeleted?: boolean;
}

export class TasksWidget extends Widget
{
	private tasks: TaskTask[] = [];
	private selectedTaskId: string | null = null;
	private currentViewMode: 'grid' | 'gantt' = 'grid';

	// UI Elements
	private ganttChartEl!: HTMLElement;
	private titleInput!: HTMLInputElement;
	private assigneeInput!: HTMLInputElement;
	private prioritySelect!: HTMLSelectElement;
	private statusSelect!: HTMLSelectElement;
	private progressSlider!: HTMLInputElement;
	private progressValEl!: HTMLElement;
	private startDateInput!: HTMLInputElement;
	private dueDateInput!: HTMLInputElement;
	private hoursInput!: HTMLInputElement;
	private _tasksSidebar?: TasksSidebar;

	private _tasksChanged: Signal<TasksWidget, TaskTask[]> = new Signal(this);


	private subSelected: (_: Widget, id: string) => any = (_, id) =>
	{
		this.selectedTaskId = id;
		this.currentViewMode = 'grid';
		// this.renderReaderPane();
		const t = this.tasks.find(t => t.id === id);
		if(t)
		{
			this.loadTaskIntoForm(t);
		}
	};
	private subEditing: (_: Widget, id: boolean) => any = (_, edit) =>
	{
		// this.isEditing = edit;
		// this.renderReaderPane();
	};
	private subChanged: (_: Widget, items: TaskTask[]) => any = (_, items) =>
	{
		this.tasks = items;
		// this.renderReaderPane();
	};

	constructor(title?: string)
	{
		super();
		this.title.label = title ?? 'Task Overview';
		this.title.iconClass = 'bx bx-task';
		this.title.closable = true;
		this.addClass('lumino-task-gantt');
		this.initDOM();
	}


	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(this._tasksSidebar && !this._tasksSidebar.isAttached)
		{
			this.openSidebar();
		}
		this.resubscribeSidebar();
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openSidebar();
		this.resubscribeSidebar();
	}

	private resubscribeSidebar()
	{
		this._tasksSidebar?.selectedTask.disconnect(this.subSelected);
		// this._tasksSidebar?.editEmail.disconnect(this.subEditing);
		this._tasksSidebar?.tasksChanged.disconnect(this.subChanged);
		this._tasksSidebar?.selectedTask.connect(this.subSelected);
		// this._tasksSidebar?.editEmail.connect(this.subEditing);
		this._tasksSidebar?.tasksChanged.connect(this.subChanged);
	}


	protected override onBeforeHide(msg: Message): void
	{
		this._tasksSidebar?.selectedTask.disconnect(this.subSelected);
		// this._tasksSidebar?.editEmail.disconnect(this.subEditing);
		this._tasksSidebar?.tasksChanged.disconnect(this.subChanged);
		this._tasksSidebar?.close();
		super.onBeforeHide(msg);
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._tasksSidebar?.selectedTask.disconnect(this.subSelected);
		// this._tasksSidebar?.editEmail.disconnect(this.subEditing);
		this._tasksSidebar?.tasksChanged.disconnect(this.subChanged);
		this._tasksSidebar?.close();
		super.onBeforeDetach(msg);
	}

	private openSidebar()
	{
		const that = this;
		setTimeout(() =>
		{
			if(widgetSelf.mainDock && widgetSelf.LayoutAdjuster && that._tasksSidebar)
			{
				if(!this._tasksSidebar?.isAttached)
				{
					widgetSelf.LayoutAdjuster?.addOptimalWidgetLayout(widgetSelf.mainDock, that._tasksSidebar, {
						type: 'outline',
						projectId: that._tasksSidebar?.constructor.name
					});
				}
			}
		}, 300);
	}


	private initDOM(): void
	{
		this.node.innerHTML = `
            <div class="tg-container">
                <!-- Top Toolbar -->
                <div class="tg-toolbar">
                    <div class="tg-toolbar-actions">
                        <button id="tgToggleViewBtn" class="tg-btn primary"><i class="bx bx-chart-stacked-rows"></i> SWITCH TO GANTT</button>
                        <button id="tgAddTaskBtn" class="tg-btn"><i class="bx bx-plus"></i> NEW OBLIGATION</button>
                        <button id="tgExportBtn" class="tg-btn"><i class="bx bx-download"></i> EXPORT TIMELINE</button>
                    </div>
                </div>

                <div class="tg-main-layout">

                    <!-- Right Workspace: Grid View or Gantt Chart View -->
                    <div class="tg-workspace">
                        <div id="tgGridView" class="tg-view-panel">
                            <div class="tg-empty-state" id="tgEmptyState">
                                <i class="bx bx-slider-alt"></i>
                                <p>Select a task to configure timeline.</p>
                            </div>
                            <div class="tg-editor-form hidden" id="tgEditorForm">
                                <div class="tg-form-header">
                                    <h3>OBLIGATION_CONFIGURATION</h3>
                                    <button id="tgDeleteTaskBtn" class="tg-btn danger sm"><i class="bx bx-trash"></i> PURGE</button>
                                </div>
                                <div class="tg-form-grid">
                                    <div class="tg-field full-width">
                                        <label>Task Title</label>
                                        <input type="text" id="tgEditTitle" />
                                    </div>
                                    <div class="tg-field">
                                        <label>Assignee / Unit</label>
                                        <input type="text" id="tgEditAssignee" />
                                    </div>
                                    <div class="tg-field">
                                        <label>Priority Matrix</label>
                                        <select id="tgEditPriority">
                                            <option value="CRITICAL">🔥 CRITICAL</option>
                                            <option value="HIGH">⚡ HIGH</option>
                                            <option value="NORMAL">📌 NORMAL</option>
                                            <option value="LOW">💤 LOW</option>
                                        </select>
                                    </div>
                                    <div class="tg-field">
                                        <label>Pipeline Status</label>
                                        <select id="tgEditStatus">
                                            <option value="TODO">TODO</option>
                                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                        </select>
                                    </div>
                                    <div class="tg-field">
                                        <label>Progress: <span id="tgProgressVal">0</span>%</label>
                                        <input type="range" id="tgEditProgress" min="0" max="100" value="0" />
                                    </div>
                                    <div class="tg-field">
                                        <label>Start Date</label>
                                        <input type="date" id="tgEditStart" />
                                    </div>
                                    <div class="tg-field">
                                        <label>Due Date</label>
                                        <input type="date" id="tgEditDue" />
                                    </div>
                                    <div class="tg-field">
                                        <label>Estimated Hours</label>
                                        <input type="number" id="tgEditHours" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Gantt Timeline View -->
                        <div id="tgGanttView" class="tg-view-panel hidden">
                            <div class="tg-gantt-header-row">
                                <span>Task Name</span>
                                <div class="tg-timeline-ruler">
                                    <span>Oct 1</span>
                                    <span>Oct 7</span>
                                    <span>Oct 14</span>
                                    <span>Oct 21</span>
                                    <span>Oct 28</span>
                                </div>
                            </div>
                            <div class="tg-gantt-bars-container" id="tgGanttBars">
                                <!-- Gantt Bars Rendered Here -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

		// Cache elements
		this.ganttChartEl = this.node.querySelector('#tgGanttBars') as HTMLElement;
		this.titleInput = this.node.querySelector('#tgEditTitle') as HTMLInputElement;
		this.assigneeInput = this.node.querySelector('#tgEditAssignee') as HTMLInputElement;
		this.prioritySelect = this.node.querySelector('#tgEditPriority') as HTMLSelectElement;
		this.statusSelect = this.node.querySelector('#tgEditStatus') as HTMLSelectElement;
		this.progressSlider = this.node.querySelector('#tgEditProgress') as HTMLInputElement;
		this.progressValEl = this.node.querySelector('#tgProgressVal') as HTMLElement;
		this.startDateInput = this.node.querySelector('#tgEditStart') as HTMLInputElement;
		this.dueDateInput = this.node.querySelector('#tgEditDue') as HTMLInputElement;
		this.hoursInput = this.node.querySelector('#tgEditHours') as HTMLInputElement;

		// Bind events
		this.node.querySelector('#tgToggleViewBtn')?.addEventListener('click', () => this.toggleViewMode());
		this.node.querySelector('#tgAddTaskBtn')?.addEventListener('click', () => this.createNewTask());
		this.node.querySelector('#tgDeleteTaskBtn')?.addEventListener('click', () => this.deleteSelectedTask());
		this.node.querySelector('#tgExportBtn')?.addEventListener('click', () => this.exportTasks());

		// Live input binding
		[this.titleInput, this.assigneeInput, this.prioritySelect, this.statusSelect, this.startDateInput, this.dueDateInput, this.hoursInput].forEach(el =>
		{
			el?.addEventListener('input', () => this.saveActiveTaskForm());
		});

		this.progressSlider?.addEventListener('input', () =>
		{
			this.progressValEl.textContent = this.progressSlider.value;
			this.saveActiveTaskForm();
		});

		this._tasksSidebar = new TasksSidebar(undefined, {
			tasksChanged: this._tasksChanged
		});

	}

	// --- DropFiles implementation for JSON task imports ---
	public async dropFiles(files: FileList): Promise<void>
	{
		for(let i = 0; i < files.length; i++)
		{
			const content = await files[i].text();
			try
			{
				const parsed = JSON.parse(content);
				const items = Array.isArray(parsed) ? parsed : [parsed];
				items.forEach((item: any) =>
				{
					this.tasks.push({
						id: 'imp-' + Math.random().toString(36).substring(2, 9),
						title: item.title || 'Imported Task',
						assignee: item.assignee || 'Unassigned',
						priority: item.priority || 'NORMAL',
						status: item.status || 'TODO',
						progress: item.progress || 0,
						startDate: item.startDate || '2026-10-01',
						dueDate: item.dueDate || '2026-10-15',
						estimatedHours: item.estimatedHours || 10
					});
				});
			} catch(err) { console.error('Failed to parse task JSON'); }
		}

		this._tasksChanged.emit([...this.tasks]);
	}

	private toggleViewMode(): void
	{
		const gridView = this.node.querySelector('#tgGridView') as HTMLElement;
		const ganttView = this.node.querySelector('#tgGanttView') as HTMLElement;
		const btn = this.node.querySelector('#tgToggleViewBtn') as HTMLElement;

		if(this.currentViewMode === 'grid')
		{
			this.currentViewMode = 'gantt';
			gridView.classList.add('hidden');
			ganttView.classList.remove('hidden');
			btn.innerHTML = `<i class="bx bx-list-ul"></i> SWITCH TO MATRIX`;
			this.renderGanttChart();
		} else
		{
			this.currentViewMode = 'grid';
			ganttView.classList.add('hidden');
			gridView.classList.remove('hidden');
			btn.innerHTML = `<i class="bx bx-chart-stacked-rows"></i> SWITCH TO GANTT`;
			// this.renderTaskList();
		}
	}

	private loadTaskIntoForm(t: TaskTask): void
	{
		const emptyState = this.node.querySelector('#tgEmptyState') as HTMLElement;
		const editorForm = this.node.querySelector('#tgEditorForm') as HTMLElement;
		emptyState.classList.add('hidden');
		editorForm.classList.remove('hidden');

		this.titleInput.value = t.title;
		this.assigneeInput.value = t.assignee;
		this.prioritySelect.value = t.priority;
		this.statusSelect.value = t.status;
		this.progressSlider.value = t.progress.toString();
		this.progressValEl.textContent = t.progress.toString();
		this.startDateInput.value = t.startDate;
		this.dueDateInput.value = t.dueDate;
		this.hoursInput.value = t.estimatedHours.toString();
	}

	private saveActiveTaskForm(): void
	{
		const task = this.tasks.find(t => t.id === this.selectedTaskId);
		if(!task) return;

		task.title = this.titleInput.value;
		task.assignee = this.assigneeInput.value;
		task.priority = this.prioritySelect.value as any;
		task.status = this.statusSelect.value as any;
		task.progress = parseInt(this.progressSlider.value) || 0;
		task.startDate = this.startDateInput.value;
		task.dueDate = this.dueDateInput.value;
		task.estimatedHours = parseFloat(this.hoursInput.value) || 0;

		this._tasksChanged.emit([task]);
	}

	private createNewTask(): void
	{
		const newTask: TaskTask = {
			id: 'task-' + Math.random().toString(36).substring(2, 9),
			title: 'New Task Node',
			assignee: 'Brian C.',
			priority: 'NORMAL',
			status: 'TODO',
			progress: 0,
			startDate: '2026-10-11',
			dueDate: '2026-10-25',
			estimatedHours: 10
		};
		this.tasks.push(newTask);
		this.selectedTaskId = newTask.id;
		if(this.currentViewMode === 'gantt') this.toggleViewMode(); // back to grid
		this.loadTaskIntoForm(newTask);
	}

	private deleteSelectedTask(): void
	{
		if(!this.selectedTaskId) return;
		const toDelete = this.tasks.filter(t => t.id === this.selectedTaskId);
		this.tasks = this.tasks.filter(t => t.id !== this.selectedTaskId);
		this.selectedTaskId = null;
		this.node.querySelector('#tgEmptyState')?.classList.remove('hidden');
		this.node.querySelector('#tgEditorForm')?.classList.add('hidden');
		this._tasksChanged.emit(toDelete.map((t: TaskTask) => { t.isDeleted = true; return t; }));
	}

	private renderGanttChart(): void
	{
		this.ganttChartEl.innerHTML = '';
		if(this.tasks.length === 0)
		{
			this.ganttChartEl.innerHTML = `<div class="tg-empty-state"><p>No tasks to render on timeline.</p></div>`;
			return;
		}

		// Base start anchor for visual offset calculation (Oct 1, 2026)
		const baseEpoch = new Date('2026-10-01').getTime();
		const totalSpanDays = 31; // October width

		this.tasks.forEach(t =>
		{
			const startEpoch = new Date(t.startDate || '2026-10-01').getTime();
			const dueEpoch = new Date(t.dueDate || '2026-10-15').getTime();

			const offsetDays = Math.max(0, (startEpoch - baseEpoch) / (1000 * 60 * 60 * 24));
			const durationDays = Math.max(1, (dueEpoch - startEpoch) / (1000 * 60 * 60 * 24));

			const leftPct = (offsetDays / totalSpanDays) * 100;
			const widthPct = Math.min(100 - leftPct, (durationDays / totalSpanDays) * 100);

			const row = document.createElement('div');
			row.className = 'tg-gantt-row';
			row.innerHTML = `
                <span class="tg-gantt-label">${this.escapeHTML(t.title)}</span>
                <div class="tg-gantt-track-area">
                    <div class="tg-gantt-bar ${t.status.toLowerCase()}" style="left: ${leftPct}%; width: ${widthPct}%;">
                        <div class="tg-gantt-progress-fill" style="width: ${t.progress}%;"></div>
                        <span class="tg-bar-text">${t.progress}%</span>
                    </div>
                </div>
            `;
			this.ganttChartEl.appendChild(row);
		});
	}

	private exportTasks(): void
	{
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.tasks, null, 2));
		const a = document.createElement('a');
		a.href = dataStr;
		a.download = `nexus_tasks_${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
