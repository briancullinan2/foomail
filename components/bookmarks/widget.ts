import { Widget } from '@lumino/widgets';
import { Message } from '@lumino/messaging';
import type { DropCapableWidget } from '../tools/drag-and-drop';
import type { GlobalToolbarsWindow } from '../bundle/menu.d';
import { BookmarkParserTools, type BookmarksDeltaFilter, type IBookmarkNode } from './widget-parsers';
import { BookmarksListWidget } from './widget-sidebar';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';


const bookmarksSelf: GlobalToolbarsWindow & LuminoLayoutWindow = self as unknown as any;


export class BookmarksWidget extends Widget implements DropCapableWidget
{
	private allBookmarks: IBookmarkNode[] = [];
	private targetFolderTree: string[] = ['Bookmarks Bar', 'Bookmarks Bar/Dev', 'Other Bookmarks'];
	private activeFilter: BookmarksDeltaFilter = 'all';
	private viewMode: 'cards' | 'grid' = 'cards';
	private selectedBookmark: IBookmarkNode | null = null;
	public _toggleBtn?: HTMLElement | HTMLDivElement;
	private _toolsSidebar?: BookmarksListWidget;

	constructor(title?: string)
	{
		super();
		this.id = 'lumino-bookmark-manager';
		this.title.label = title ?? "Bookmark Merge";
		this.title.iconClass = 'bx bx-bookmarks';
		this.title.closable = true;
		this.title.className = this.id;
		this.addClass('bm-manager-widget');
		this.renderLayout();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(this._toolsSidebar && !this._toolsSidebar.isAttached)
		{
			this.openSidebar();
		}
		setTimeout(() =>
		{
			bookmarksSelf.WidgetSearchBar.attachToggleIcon(this, this.renderToggleBtn, this.clickToggleBtn);
		}, 200);
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			this._toolsSidebar?.close();
		}

		super.processMessage(msg);
	}


	protected override onBeforeHide(msg: Message): void
	{
		this._toolsSidebar?.close();
		super.onBeforeHide(msg);
	}


	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openSidebar();
	}


	private openSidebar()
	{
		const that = this;
		setTimeout(() =>
		{
			if(bookmarksSelf.mainDock && bookmarksSelf.LayoutAdjuster && that._toolsSidebar)
			{
				if(!this._toolsSidebar?.isAttached)
				{
					bookmarksSelf.LayoutAdjuster?.addOptimalWidgetLayout(bookmarksSelf.mainDock, that._toolsSidebar, {
						type: 'outline',
						projectId: that._toolsSidebar?.constructor.name
					});
				}
			}
		}, 300);
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._toolsSidebar?.close();

		if(this._toggleBtn)
		{
			this._toggleBtn?.remove();
			this._toggleBtn = undefined;
		}
		super.onBeforeDetach(msg);
	}

	protected renderToggleBtn(toggle: HTMLElement)
	{
		toggle.innerHTML = `<i class="bx ${this.viewMode === 'grid' ? 'bx-list' : 'bx-grid'}"></i>`;
		toggle.title = this.viewMode === 'grid' ? 'List View' : 'Cards View';
	}


	protected clickToggleBtn()
	{
		this.viewMode = this.viewMode === 'grid' ? 'cards' : 'grid';
		this.renderLayout();
		this.fit();
		this.update();
	}

	/**
	 * Main DOM Shell Construction
	 */
	private renderLayout(): void
	{
		this.node.innerHTML = '';
		this.node.appendChild(this.createMainViewGrid());

		this._toolsSidebar = new BookmarksListWidget();

	}

	/**
	 * Main View: Chrome-Style Bookmark Grid / Expanding Inspector View
	 */
	private createMainViewGrid(): HTMLElement
	{
		const mainView = document.createElement('div');
		mainView.className = 'bm-main-view';

		const filtered = this.allBookmarks.filter((b) =>
		{
			if(this.activeFilter === 'all') return true;
			return b.status === this.activeFilter;
		});

		if(filtered.length === 0)
		{
			mainView.innerHTML = `
        <div class="bm-empty-state">
          <h3>No Bookmarks Loaded or Filtered</h3>
          <p>Drop one or more HTML / Chrome Bookmarks JSON files into the dropzone to visualize and diff.</p>
        </div>
      `;
			return mainView;
		}

		const gridWrapper = document.createElement('div');
		gridWrapper.className = this.viewMode === 'cards' ? 'bm-cards-grid' : 'bm-expanding-grid';

		filtered.forEach((bm) =>
		{
			const card = document.createElement('div');
			card.className = `bm-card bm-status-${bm.status} ${this.selectedBookmark?.id === bm.id ? 'active-selected' : ''}`;

			const iconUrl = bm.icon || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23666" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

			card.innerHTML = `
        <div class="bm-card-header">
          <img class="bm-card-icon" src="${iconUrl}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\'><circle cx=\\'8\\' cy=\\'8\\' r=\\'7\\' fill=\\'%23ccc\\'/></svg>'" />
          <div class="bm-card-title">${this.escapeHtml(bm.title)}</div>
          <span class="bm-status-badge badge-${bm.status}">${bm.status.toUpperCase()}</span>
        </div>
        <div class="bm-card-body">
          <div class="bm-card-url">${this.escapeHtml(bm.url || 'No URL')}</div>
          <div class="bm-card-meta">
            <span class="bm-meta-path">📁 ${this.escapeHtml(bm.path)}</span>
            <span class="bm-meta-date">${bm.timestamp ? bm.timestamp.toLocaleDateString() : 'N/A'}</span>
          </div>
          ${bm.misfitReason ? `<div class="bm-card-warning">${bm.misfitReason}</div>` : ''}
        </div>
      `;

			card.onclick = () =>
			{
				this.selectedBookmark = bm;
				this.renderLayout();
			};

			gridWrapper.appendChild(card);
		});

		mainView.appendChild(gridWrapper);

		// Inspector Side Sheet for Detailed Inspections & Download/PDF triggers
		if(this.selectedBookmark)
		{
			mainView.appendChild(this.createInspectorPanel(this.selectedBookmark));
		}

		return mainView;
	}

	/**
	 * Bookmark Inspector Panel (Extra details, single item export, PDF print snippet)
	 */
	private createInspectorPanel(bm: IBookmarkNode): HTMLElement
	{
		const inspector = document.createElement('div');
		inspector.className = 'bm-inspector-panel';

		inspector.innerHTML = `
      <div class="bm-inspector-header">
        <h4>Bookmark Details</h4>
        <button class="bm-close-btn">&times;</button>
      </div>
      <div class="bm-inspector-content">
        <label>Title</label>
        <input type="text" value="${this.escapeHtml(bm.title)}" readonly />

        <label>URL</label>
        <input type="text" value="${this.escapeHtml(bm.url || '')}" readonly />

        <label>Folder Target Path</label>
        <input type="text" value="${this.escapeHtml(bm.path)}" readonly />

        <label>Diff Status Classification</label>
        <div class="bm-status-pill pill-${bm.status}">${bm.status.toUpperCase()}</div>

        <div class="bm-inspector-actions">
          <a href="${bm.url}" target="_blank" class="bm-btn bm-btn-primary">Open Link</a>
          <button id="btn-inspector-pdf" class="bm-btn bm-btn-secondary">Export Record</button>
        </div>
      </div>
    `;

		inspector.querySelector('.bm-close-btn')?.addEventListener('click', () =>
		{
			this.selectedBookmark = null;
			this.renderLayout();
		});

		return inspector;
	}


	public async dropFiles(files: FileList)
	{

		if(files && files.length > 0)
		{
			for(let i = 0; i < files.length; i++)
			{
				await BookmarkParserTools.processDroppedFile(files[i]);
			}
			this.recalculateStatuses();
			this.renderLayout();
		}
	}


	/**
	 * Recalculates diff flags (Duplicate = Green, Misfit = Blue, Missing = Red)
	 */
	private recalculateStatuses(): void
	{
		const urlMap = new Map<string, number>();

		// Count URLs for duplicates
		this.allBookmarks.forEach((b) =>
		{
			if(b.url)
			{
				urlMap.set(b.url, (urlMap.get(b.url) || 0) + 1);
			}
		});

		this.allBookmarks.forEach((b) =>
		{
			// 1. Duplicate check
			if(b.url && (urlMap.get(b.url) || 0) > 1)
			{
				b.status = 'duplicate';
				return;
			}

			// 2. Misfit check against user JSON schema
			const matchesSchema = this.targetFolderTree.some(
				(targetPath) => targetPath.toLowerCase() === b.path.toLowerCase()
			);

			if(!matchesSchema && this.targetFolderTree.length > 0)
			{
				b.status = 'misfit';
				b.misfitReason = `Path "${b.path}" not in target JSON schema`;
				return;
			}

			b.status = 'normal';
		});
	}


	private escapeHtml(str: string): string
	{
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
}
