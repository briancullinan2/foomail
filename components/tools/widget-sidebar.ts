import { Message } from "@lumino/messaging";
import { Widget } from "@lumino/widgets";
import type { ComponentRoute } from "../bundle/menu";
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { WidgetExtensionsWindow } from "../bundle/widget-extensions";


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& RepositorySettingsWindow & WidgetExtensionsWindow = self as unknown as any;



export class ToolsSidebar extends widgetSelf.SingletonSidebarWidget
{
	private _registry?: Record<string, ComponentRoute>;
	private _searchQuery: string = '';
	private _sidebarContainer!: HTMLDivElement;
	private _searchInput!: HTMLInputElement;
	private _modulesContainer!: HTMLDivElement;
	private _selectedKey: string | null = null;
	private _onSelectTool?: (key: string, route: ComponentRoute) => void = (key) =>
	{
		widgetSelf.triggerPanelRoute?.(key, widgetSelf.mainDock);
	};

	constructor(title?: string, options?: Widget.IOptions)
	{
		super(ToolsSidebar.name, title ?? 'Tools', options);

		this.addClass('tools-sidebar');

		this._registry = (options as any)?.registry ?? widgetSelf.TOOLS_REGISTRY;
		this._buildUI();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this._renderSidebar();
	}


	private _buildUI(): void
	{
		this.node.innerHTML = '';

		// Sidebar panel
		const sidebar = document.createElement('aside');
		sidebar.className = 'tools-sidebar';

		const sidebarHeader = document.createElement('div');
		sidebarHeader.className = 'tools-sidebar-header';
		sidebarHeader.innerHTML = `<h3><i class="bx bx-spanner"></i> Tool Set</h3>`;

		const searchBox = document.createElement('div');
		searchBox.className = 'tools-search-box';

		this._searchInput = document.createElement('input');
		this._searchInput.type = 'text';
		this._searchInput.placeholder = 'Filter tools...';
		this._searchInput.addEventListener('input', (e) =>
		{
			this._searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this._renderSidebar();
		});

		searchBox.appendChild(this._searchInput);

		this._sidebarContainer = document.createElement('div');
		this._sidebarContainer.className = 'tools-list';

		sidebar.appendChild(sidebarHeader);
		sidebar.appendChild(searchBox);
		sidebar.appendChild(this._sidebarContainer);

		this.node.appendChild(sidebar);

		this._buildModules(sidebar);
	}


	private _buildModules(sidebar: HTMLElement): void
	{

		const sidebarHeader = document.createElement('div');
		sidebarHeader.className = 'tools-sidebar-header';
		sidebarHeader.innerHTML = `<h3><i class="bx bx-cog"></i> Modules</h3>`;

		sidebar.appendChild(sidebarHeader);
		// sidebar.appendChild(searchBox);

		this._modulesContainer = document.createElement('div');
		this._modulesContainer.className = 'tools-list';
		sidebar.appendChild(this._modulesContainer);

	}


	private _renderSidebar(): void
	{
		if(!this._sidebarContainer || !this._registry) return;
		this._sidebarContainer.innerHTML = '';

		const entries = Object.entries(this._registry).filter(([key, route]) =>
		{
			if(!this._searchQuery) return true;
			return (
				route.label.toLowerCase().includes(this._searchQuery) ||
				key.toLowerCase().includes(this._searchQuery) ||
				(route.description && route.description.toLowerCase().includes(this._searchQuery))
			);
		});

		if(entries.length === 0)
		{
			const emptyMsg = document.createElement('div');
			emptyMsg.className = 'tools-empty-state';
			emptyMsg.textContent = 'No matching tools found';
			this._sidebarContainer.appendChild(emptyMsg);
			return;
		}

		entries.forEach(([key, route]) =>
		{
			const item = document.createElement('div');
			item.className = `tools-item ${key === this._selectedKey ? 'active' : ''}`;
			item.onclick = () => this.selectTool(key);

			item.innerHTML = `
			<div class="tools-item-icon"><i class="${route.iconClass}"></i></div>
			<div class="tools-item-meta">
			  <span class="tools-item-title">${this._escapeHTML(route.label)}</span>
			  <span class="tools-item-key">${this._escapeHTML(key)}</span>
			</div>
		  `;

			this._sidebarContainer.appendChild(item);
		});

		this._renderModules();

	}

	private _renderModules(): void
	{
		if(!this._modulesContainer || !widgetSelf.MODULE_REGISTRY) return;
		this._modulesContainer.innerHTML = '';

		const entries = Object.entries(widgetSelf.MODULE_REGISTRY).filter(([key, route]) =>
		{
			if(!route.url) return false;
			if(!this._searchQuery) return true;
			return (
				route.label.toLowerCase().includes(this._searchQuery) ||
				key.toLowerCase().includes(this._searchQuery) ||
				(route.description && route.description.toLowerCase().includes(this._searchQuery))
			);
		});

		if(entries.length === 0)
		{
			const emptyMsg = document.createElement('div');
			emptyMsg.className = 'tools-empty-state';
			emptyMsg.textContent = 'No matching tools found';
			this._modulesContainer.appendChild(emptyMsg);
			return;
		}

		entries.forEach(([key, route]) =>
		{
			const item = document.createElement('div');
			item.id = 'tool-' + key;
			item.className = `tools-item ${key === this._selectedKey ? 'active' : ''}`;
			item.onclick = () => this.selectTool(key);

			item.innerHTML = `
			<div class="tools-item-icon"><i class="${route.iconClass}"></i></div>
			<div class="tools-item-meta">
			  <span class="tools-item-title">${this._escapeHTML(route.label)}</span>
			  <span class="tools-item-key">${this._escapeHTML(key)}</span>
			</div>
		  `;

			this._modulesContainer.appendChild(item);
		});
	}

	private _escapeHTML(str: string): string
	{
		return str.replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}

	private _updateSidebar()
	{
		const tools = this.node.querySelectorAll('.tools-item.active');
		for(const tool of tools)
		{
			if(tool.id !== 'tool-' + this._selectedKey)
			{
				tool.classList.remove('active');
			}
		}

	}


	/**
	 * Programmatically select a tool by its key.
	 */
	public selectTool(key: string): void
	{
		if(!this._registry?.[key] && !widgetSelf.MODULE_REGISTRY?.[key]) return;
		this._selectedKey = key;
		// TODO: update that clear and moves the active class
		this._updateSidebar();

		if(this._onSelectTool)
		{
			this._onSelectTool(key, this._registry?.[key] ?? widgetSelf.MODULE_REGISTRY?.[key]);
		}
	}
}
