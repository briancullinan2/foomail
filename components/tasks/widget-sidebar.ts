import { ISignal, Signal } from "@lumino/signaling";
import { Widget } from "@lumino/widgets";
import type { TasksWidget, TaskTask } from "./widget";
import { Message } from "@lumino/messaging";
import { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import { LuminoLayoutWindow } from "../bundle/lumino.d";

export interface ITasksOptions
{
	tasksChanged: ISignal<TasksWidget, TaskTask[]>;
}


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

export class TasksSidebar extends Widget
{
	private taskListEl!: HTMLElement;
	private selectedTaskId: string | null = null;


	private _mainpanelChanged?: ISignal<TasksWidget, TaskTask[]>;
	private _mainpanelSub: (main: TasksWidget, items: TaskTask[]) => void = (_, items) =>
	{
		this.tasks = items;
		this.renderTaskList();
	};


	private _selectedTask: Signal<TasksSidebar, string> = new Signal(this);
	private tasks: TaskTask[] = [];
	private static _instance?: TasksSidebar;

	public get selectedTask(): ISignal<TasksSidebar, string>
	{
		return this._selectedTask;
	}

	private _tasksChanged: Signal<TasksSidebar, TaskTask[]> = new Signal(this);

	public get tasksChanged(): ISignal<TasksSidebar, TaskTask[]>
	{
		return this._tasksChanged;
	}

	private loadSampleTasks(): void
	{
		this.tasks = [
			{
				id: 'task-1',
				title: 'Refactor DuckDB-Wasm Thread Loader',
				assignee: 'Brian C.',
				priority: 'CRITICAL',
				status: 'IN_PROGRESS',
				progress: 65,
				startDate: '2026-10-01',
				dueDate: '2026-10-12',
				estimatedHours: 24
			},
			{
				id: 'task-2',
				title: 'Configure Cloudflare Tunnels for pryor.games',
				assignee: 'Brian C.',
				priority: 'HIGH',
				status: 'COMPLETED',
				progress: 100,
				startDate: '2026-10-03',
				dueDate: '2026-10-06',
				estimatedHours: 8
			},
			{
				id: 'task-3',
				title: 'Draft 100th Birthday Celebration Itinerary',
				assignee: 'Family',
				priority: 'NORMAL',
				status: 'TODO',
				progress: 20,
				startDate: '2026-10-10',
				dueDate: '2026-10-24',
				estimatedHours: 12
			}
		];

		this.renderTaskList();
		this._tasksChanged.emit(this.tasks);
	}

	constructor(title?: string, options?: ITasksOptions)
	{
		if(!TasksSidebar._instance)
		{
			super();
			TasksSidebar._instance = this;
			this.title.label = title ?? 'Tasks';
			this.title.iconClass = 'bx bx-card-view-tiles';
			this.title.closable = true;
			this.initDom();
			// this.loadStellarDemoData();
			this.loadSampleTasks();
		}
		if(options?.tasksChanged)
		{
			TasksSidebar._instance._mainpanelChanged?.disconnect(TasksSidebar._instance._mainpanelSub);
			TasksSidebar._instance._mainpanelChanged = options.tasksChanged;
			TasksSidebar._instance._mainpanelChanged.connect(TasksSidebar._instance._mainpanelSub);
		}
		return TasksSidebar._instance;
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			console.log('Intercepted close request, hiding instead: ' + this.title.label);

			this.hide();
			widgetSelf.mainDock?.layout?.removeWidget(this);
			return; // BAIL OUT: Avoid calling super.processMessage() to prevent disposal
		}

		super.processMessage(msg);
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.loadSampleTasks();
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.renderTaskList();
	}


	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.renderTaskList();
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		super.onBeforeDetach(msg);
	}


	private initDom()
	{
		this.node.innerHTML = `
			<div class="tg-filter-bar">
				<input type="text" id="tgSearchInput" placeholder="Filter tasks..." />
			</div>
			<div class="tg-task-list" id="tgTaskList">
				<!-- Populated dynamically -->
			</div>`;
		this.taskListEl = this.node.querySelector('#tgTaskList') as HTMLElement;
	}


	private renderTaskList(): void
	{
		this.taskListEl.innerHTML = '';
		this.tasks.forEach(t =>
		{
			const isSelected = t.id === this.selectedTaskId;
			const item = document.createElement('div');
			item.className = `tg-task-item ${isSelected ? 'selected' : ''}`;
			item.innerHTML = `
                <div class="tg-item-top">
                    <span class="tg-item-title">${this.escapeHTML(t.title)}</span>
                    <span class="tg-priority-badge ${t.priority.toLowerCase()}">${t.priority}</span>
                </div>
                <div class="tg-item-bottom">
                    <span>👤 ${this.escapeHTML(t.assignee)}</span>
                    <span>⏳ ${t.progress}%</span>
                </div>
            `;
			item.addEventListener('click', () =>
			{
				this.selectedTaskId = t.id;
				this.renderTaskList();
				this._selectedTask.emit(t.id);
			});
			this.taskListEl.appendChild(item);
		});
	}


	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
