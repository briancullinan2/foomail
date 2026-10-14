import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { IMainpanelOptions, WidgetExtensionsWindow } from "../bundle/widget-extensions";
import type { JournalEntry, NotesWidget } from "./widget";


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& RepositorySettingsWindow & WidgetExtensionsWindow = self as unknown as any;

export class NotesSidebar extends widgetSelf.SidebarChangeWidget<NotesWidget, JournalEntry>
{
	private entryListEl!: HTMLElement;

	constructor(title?: string, options?: IMainpanelOptions<NotesWidget, JournalEntry[]>)
	{
		super(NotesSidebar.name, title ?? 'Entry Log', options);
		this.initDom();
	}


	private initDom()
	{
		this.node.innerHTML = `
			<div class="tj-log-list" id="tjLogList">
				<!-- Populated dynamically -->
			</div>`;
		this.entryListEl = this.node.querySelector('#tjLogList') as HTMLElement;
	}


	protected filterAndRender(): void
	{
		this.entryListEl.innerHTML = '';
		this.items?.forEach(e =>
		{
			const isSelected = e.id === this._selectedItemId;
			const item = document.createElement('div');
			item.className = `tj-log-item ${isSelected ? 'selected' : ''}`;
			item.innerHTML = `
                <div class="tj-item-top">
                    <span class="tj-item-title">${this.escapeHTML(e.title)}</span>
                    <span class="tj-mood-indicator ${e.mood.toLowerCase()}">●</span>
                </div>
                <div class="tj-item-meta">
                    <span>${e.timestamp}</span>
                    <span>${e.wordCount} words</span>
                </div>
            `;
			item.addEventListener('click', () =>
			{
				this._selectedItemId = e.id;
				this.filterAndRender();
			});
			this.entryListEl.appendChild(item);
		});
	}

}
