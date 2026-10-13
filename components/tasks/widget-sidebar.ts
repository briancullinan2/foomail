import { ISignal, Signal } from "@lumino/signaling";
import { Widget } from "@lumino/widgets";
import type { TasksWidget, TaskTask } from "./widget";
import { Message } from "@lumino/messaging";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { IMainpanelOptions, WidgetExtensionsWindow } from "../bundle/widget-extensions";


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& WidgetExtensionsWindow = self as unknown as any;

export class TasksSidebar extends widgetSelf.SidebarChangeWidget<TasksWidget, TaskTask>
{
	private taskListEl!: HTMLElement;

	private loadSampleTasks(): void
	{
		this.items = [
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

		this.filterAndRender();
		this._itemsChanged.emit(this.items);
	}

	constructor(title?: string, options?: IMainpanelOptions<TasksWidget, TaskTask[]>)
	{
		super(TasksSidebar.name, options);
		this.title.label = title ?? 'Tasks';
		this.title.iconClass = 'bx bx-card-view-tiles';
		this.title.closable = true;
		this.initDom();
		// this.loadStellarDemoData();
		this.loadSampleTasks();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.loadSampleTasks();
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


	protected filterAndRender(): void
	{
		this.taskListEl.innerHTML = '';
		this.items?.forEach(t =>
		{
			const isSelected = t.id === this._selectedItemId;
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
				this._selectedItemId = t.id;
				this.filterAndRender();
				this._selectedItem.emit(t);
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
