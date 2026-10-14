import { Widget } from '@lumino/widgets';
import type { ComponentRoute } from '../bundle/menu';
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import { ToolsSidebar } from './widget-sidebar';
import { Message } from '@lumino/messaging';
import type { WidgetExtensionsWindow } from '../bundle/widget-extensions';


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& RepositorySettingsWindow & WidgetExtensionsWindow = self as unknown as any;


export interface ToolsDetailsWidgetOptions
{
	registry?: Record<string, ComponentRoute>;
	onSelectTool?: (key: string, route: ComponentRoute) => void;
}


export type IconSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';


export class ToolsWidget extends widgetSelf.AutoSidebarWidget<ToolsSidebar>
{
	private _registry?: Record<string, ComponentRoute>;
	private _selectedKey: string | null = null;
	private _onSelectTool?: (key: string, route: ComponentRoute) => void = (key) =>
	{
		widgetSelf.triggerPanelRoute?.(key, widgetSelf.mainDock);
	};

	public modules: Record<string, Record<string, Function>> = LOCAL_COMMANDS;
	private _detailsContainer!: HTMLElement;


	constructor(title?: string, options: ToolsDetailsWidgetOptions = {})
	{
		super();
		this.addClass('lm-ToolsDetailsWidget');
		this.addClass('zoom-' + this.zoom);
		this.title.label = title ?? 'Tools';
		this.title.iconClass = 'bx bx-spanner';
		this.title.closable = true;


		this._registry = options.registry ?? widgetSelf.TOOLS_REGISTRY;
		this._onSelectTool = options.onSelectTool;

		this._buildUI();
		if(this._registry)
		{
			const firstKey = Object.keys(this._registry)[0];
			if(firstKey)
			{
				this.selectTool(firstKey);
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
		// this._renderSidebar();
		this._renderDetails();

		if(this._onSelectTool)
		{
			this._onSelectTool(key, this._registry?.[key] ?? widgetSelf.MODULE_REGISTRY?.[key]);
		}
	}

	/**
	 * Dynamically update or replace the tool registry.
	 */
	public updateRegistry(newRegistry: Record<string, ComponentRoute>): void
	{
		this._registry = newRegistry;
		// this._renderSidebar();
		if(this._selectedKey && this._registry[this._selectedKey])
		{
			this._renderDetails();
		} else
		{
			const firstKey = Object.keys(this._registry)[0];
			if(firstKey) this.selectTool(firstKey);
		}
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(this._selectedKey)
		{
			this._renderDetails();
		}
	}


	private _buildUI(): void
	{
		this.node.innerHTML = '';

		// Main Details panel
		this._detailsContainer = document.createElement('main') as HTMLElement;
		this._detailsContainer.className = 'tools-details-view';

		this._sidebarWidget = new ToolsSidebar();

		this.node.appendChild(this._detailsContainer);
	}


	private _renderDetails(): void
	{
		if(!this._detailsContainer || !this._registry) return;

		this._detailsContainer.innerHTML = '';

		if(this.zoom === 'huge')
		{
			const route = this._selectedKey
				? this._registry?.[this._selectedKey] ?? widgetSelf.MODULE_REGISTRY?.[this._selectedKey]
				: undefined;
			if(!route)
			{
				this._detailsContainer.innerHTML = `
					<div class="tools-placeholder">
					<i class="bx bx-select-multiple"></i>
					<p>Select a tool from the list to view its configuration and operational details.</p>
					</div>
				`;
				return;
			}
			this._renderDetailsHuge(route);
		} else
		{
			const all = { ...(this._registry ?? {}), ...(widgetSelf.MODULE_REGISTRY ?? {}) };
			for(const routeKey of Object.keys(all))
			{
				const route = this._registry?.[routeKey] ?? widgetSelf.MODULE_REGISTRY?.[routeKey];
				route.key = routeKey;
				this._renderDetailsHuge(route);
			}
		}
	}

	private _renderDetailsHuge(route?: ComponentRoute): void
	{
		if(!this._detailsContainer || !this._registry || !route) return;

		const card = document.createElement('div');
		card.className = 'tools-card';
		card.innerHTML += `
      <header class="tools-card-header">
        <div class="tools-card-badge">
          <i class="${route.iconClass}"></i>
        </div>
        <div class="tools-card-title-group">
          <h2>${this._escapeHTML(route.label)}</h2>
          <code class="tools-key-tag">${this._escapeHTML(route.key ?? this._selectedKey ?? '')}</code>
          <code class="tools-key-tag" title="${this._escapeHTML(route.url ?? '')}">${this._escapeHTML(route.className ?? '')}</code>
        </div>
      </header>

      <section class="tools-card-section">
        <h4><i class="bx bx-text"></i> Overview & Capability</h4>
        <p class="tools-description-text">${this._escapeHTML(route.description || 'No detailed description provided.')}</p>
      </section>

      <section class="tools-card-section">
        <h4><i class="bx bx-code-block"></i> System Requirements</h4>
        <div class="tools-subtext-box">
          <i class="bx bx-info-circle"></i>
          <span>${this._escapeHTML(route.subtext || 'No dependency notes recorded.')}</span>
        </div>
      </section>

      <section class="tools-card-section">
        <h4><i class="bx bx-slider-alt"></i> Routing Metadata</h4>
        <div class="tools-meta-grid">
          <div class="meta-row">
            <span class="meta-label">Module Target:</span>
            <code class="meta-value">${route.url ? this._escapeHTML(route.url) : ''}</code>
          </div>
          <div class="meta-row">
            <span class="meta-label">Class Identifier:</span>
            <code class="meta-value">${route.className ? this._escapeHTML(route.className) : ''}</code>
          </div>
          <div class="meta-row">
            <span class="meta-label">Icon Specifier:</span>
            <code class="meta-value">${this._escapeHTML(route.iconClass)}</code>
          </div>
        </div>
      </section>

      <footer class="tools-card-actions">
        <button class="tools-action-btn primary" id="btn-launch-tool">
          <i class="bx bx-play-circle"></i> Initialize<span> ${route.label ?? (route.className ? this._escapeHTML(route.className) : '')}</span>
        </button>
      </footer>
    `;

		this._detailsContainer.appendChild(card);

		const launchBtn = card.querySelector('#btn-launch-tool');
		if(launchBtn)
		{
			launchBtn.addEventListener('click', () =>
			{
				if(this._onSelectTool && this._selectedKey)
				{
					this._onSelectTool(this._selectedKey, route);
				}
			});
		}
	}

	private _escapeHTML(str: string): string
	{
		return str.replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}


	public setZoom(delta?: number)
	{
		if(delta === -1)
		{
			if(this.zoom === 'tiny')
			{

			} else if(this.zoom === 'small')
			{
				this.zoom = 'tiny';
			} else if(this.zoom === 'medium')
			{
				this.zoom = 'small';
			} else if(this.zoom === 'large')
			{
				this.zoom = 'medium';
			} else if(this.zoom === 'huge')
			{
				this.zoom = 'large';
			} else
			{
				this.zoom = 'medium';
			}
		}
		else if(delta === 1)
		{
			if(this.zoom === 'tiny')
			{
				this.zoom = 'small';
			} else if(this.zoom === 'small')
			{
				this.zoom = 'medium';
			} else if(this.zoom === 'medium')
			{
				this.zoom = 'large';
			} else if(this.zoom === 'large')
			{
				this.zoom = 'huge';
			} else if(this.zoom === 'huge')
			{

			} else
			{
				this.zoom = 'medium';
			}
		} else if(delta === 0)
		{
			this.zoom = 'medium';
		}

		for(const c of this.node.classList)
		{
			if(c.startsWith('zoom-') && c !== this.zoom)
			{
				this.removeClass(c);
			}
		}
		this.addClass('zoom-' + this.zoom);
	}

	private zoom: IconSize = 'medium';

}

const LOCAL_COMMANDS: Record<string, Record<string, Function>> = {};


LOCAL_COMMANDS['view/zoom'] = {
	in: function ()
	{
		//const toolbar = fileviewSelf.ViewToolbar?.getInstance();
		//toolbar?.toggleHiddenFiles();
		const activeWidget = widgetSelf.lastInteractedWidget ?? widgetSelf.previousInteractedWidget;
		if(typeof (activeWidget as any)?.setZoom === 'function')
		{
			(activeWidget as any).setZoom(1);
		}
	},
	out: function ()
	{
		//const toolbar = fileviewSelf.ViewToolbar?.getInstance();
		//toolbar?.toggleHiddenFiles();
		const activeWidget = widgetSelf.lastInteractedWidget ?? widgetSelf.previousInteractedWidget;
		if(typeof (activeWidget as any)?.setZoom === 'function')
		{
			(activeWidget as any).setZoom(-1);
		}
	}
};
