import { Title, Widget } from "@lumino/widgets";
import type { GlobalToolbarsWindow } from "../bundle/menu.d";
import { Message } from "@lumino/messaging";
import type { LuminoLayoutWindow } from "./lumino.d";

export interface ISearchable
{
	id?: string;
	node: HTMLElement;
	title: Title<Widget>;
	searchContainer?: HTMLDivElement;
	searchInput?: HTMLInputElement;
	searchObserver?: ResizeObserver;
	parentTabBar?: HTMLElement;
	executeFindQuery?(pooledCtx: any, event?: KeyboardEvent | null): void;
}

export interface ITabButton extends ISearchable
{
	parent?: Widget | null;
	_toggleBtn?: HTMLElement | HTMLDivElement;
}


const searchSelf: GlobalToolbarsWindow & LuminoLayoutWindow = self as unknown as any;


// TODO: replace terminal search attachment with this widget
export class WidgetWithSearchBar extends Widget implements ISearchable
{
	static readonly resizeListeners: EventListener[] = [];
	static readonly seenContexts: ISearchable[] = [];
	public searchContainer?: HTMLDivElement;
	public searchInput?: HTMLInputElement;
	public searchObserver?: ResizeObserver;
	public parentTabBar?: HTMLElement;
	public executeFindQuery?(pooledCtx: any, event?: KeyboardEvent | null): void;

	protected get defaultId(): string
	{
		return this.id ?? ('lm-Widget-' + this.constructor.name + '-' + searchSelf.nextTemp?.());
	}

	private static createSearchElement(context: ISearchable): void
	{
		if(!context || context.searchContainer)
		{
			return;
		}
		context.searchContainer = document.createElement('div');
		context.searchContainer.className = 'lumino-tab-search-wrapper';
		// Start hidden until onAfterShow fires
		context.searchContainer.style.display = 'none';

		context.searchInput = document.createElement('input');
		context.searchInput.type = 'search';
		context.searchInput.id = 'search-widget';
		context.searchInput.placeholder = 'Search...';
		context.searchInput.autocomplete = 'off';

		context.searchInput.addEventListener('keypress', event =>
		{
			if(event.key === 'Enter')
			{
				event.preventDefault();
			}

			if(!context)
			{
				return;
			}

			context.executeFindQuery?.(context, event);
		});
		context.searchContainer.appendChild(context.searchInput);
		context.searchObserver = new ResizeObserver((entries) =>
		{
			//for(const entry of entries)
			//{
			//const { width, height } = entry.contentRect;
			//}
			WidgetWithSearchBar.resizeSearchContainer(context);
		});
		context.searchObserver.observe(context.node);
	}


	protected static getTabBar(context: ISearchable): HTMLElement | undefined
	{
		//context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`.lm-TabBar:has(li.${context.id})`) as HTMLElement;
		const bars = searchSelf.mainDock?.tabBars() ?? [];
		for(const bar of bars)
		{
			const i = bar.titles.indexOf(context.title);
			if(i > -1)
			{
				return (context.id && context.id.length > 0
					? bar.node.querySelector(`li.lm-TabBar-tab.${context.id}`) as HTMLElement
					: undefined)
					?? bar.node.querySelector(`li.lm-TabBar-tab:nth-of-type(${i + 1})`) as HTMLElement;
			}
		}
	}


	/**
	 * Triggered by Lumino lifecycle manager when the tab layout brings this item into view.
	 */
	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		WidgetWithSearchBar.createSearchElement(this);
		window.requestAnimationFrame(() =>
		{
			this.showSearchBar(this);
		});
	}

	private static resizeSearchContainer = (context: ISearchable) =>
	{

		const parentTabBar = this.getTabBar(context);

		if(!parentTabBar || !context
			|| !context.searchContainer
			|| context.searchContainer.style.display === 'none')
		{
			return;
		}

		if('parentTabBar' in context)
		{
			if(parentTabBar !== context.parentTabBar)
			{
				parentTabBar.appendChild(context.searchContainer);
			}
		} else
		{
			parentTabBar?.appendChild(context.searchContainer);
		}

		if(typeof context === 'object')
		{
			context.parentTabBar = parentTabBar;
		}

		// Ensure searchContainer doesn't push the tab bar layout around
		context.searchContainer.style.position = 'absolute';
		context.searchContainer.style.right = '0px';

		const totalWidth = parentTabBar.getBoundingClientRect().width;
		let occupiedWidth = 0;

		// Target the actual tab items (typically 'li' elements with the class '.lm-TabBar-tab')
		// instead of the full-width wrapper panels.
		const actualTabs = parentTabBar.querySelectorAll('.lm-TabBar-content li');

		actualTabs.forEach((tab) =>
		{
			const element = tab as HTMLElement;
			const rect = element.getBoundingClientRect();

			const style = window.getComputedStyle(element);
			const margins = parseFloat(style.marginLeft || '0') + parseFloat(style.marginRight || '0');
			const elementTotalWidth = rect.width + margins;

			// If adding this element exceeds the available row width, it wraps to a new row.
			// We reset the row's occupied width tracking back to 0 before adding this element.
			if(occupiedWidth + elementTotalWidth > totalWidth && occupiedWidth > 0)
			{
				occupiedWidth = 0;
			}

			occupiedWidth += elementTotalWidth;
		});

		// Handle any extra functional sibling controls (like scroll buttons if present)
		const extraControls = parentTabBar.querySelectorAll('.lm-TabBar-scrollButton');
		extraControls.forEach((control) =>
		{
			const element = control as HTMLElement;
			const rect = element.getBoundingClientRect();
			const elementTotalWidth = rect.width;

			if(occupiedWidth + elementTotalWidth > totalWidth && occupiedWidth > 0)
			{
				occupiedWidth = 0;
			}

			occupiedWidth += elementTotalWidth;
		});

		// Set max-width based on the remaining space on the final row line
		const remainingSpace = Math.max(0, totalWidth - occupiedWidth - 15);
		context.searchContainer.style.maxWidth = `${remainingSpace}px`;
	};

	private showSearchBar(context: ISearchable)
	{
		context.parentTabBar = WidgetWithSearchBar.getTabBar(context);

		if(context.parentTabBar && context && context.searchContainer)
		{
			context.parentTabBar.appendChild(context.searchContainer);
			context.searchContainer.style.display = 'flex';

			// Calculate initial width
			window.requestAnimationFrame(() =>
			{
				WidgetWithSearchBar.resizeSearchContainer(context);
			});

			// Listen for window resizing to keep the width updated
			let contextId = WidgetWithSearchBar.seenContexts.indexOf(context);
			if(contextId > -1)
			{
				window.removeEventListener('resize', WidgetWithSearchBar.resizeListeners[contextId]);
				WidgetWithSearchBar.seenContexts.splice(contextId, 1);
				WidgetWithSearchBar.resizeListeners.splice(contextId, 1);
			} else
			{
				contextId = WidgetWithSearchBar.resizeListeners.length;
			}
			WidgetWithSearchBar.seenContexts[contextId] = context;
			WidgetWithSearchBar.resizeListeners[contextId] = WidgetWithSearchBar.resizeSearchContainer.bind(context, context);
			window.addEventListener('resize', WidgetWithSearchBar.resizeListeners[contextId]);
			context.searchObserver?.observe(context.node);
		}
	}

	/**
	 * Triggered by Lumino lifecycle manager when the tab loses active focus or is moved.
	 */
	protected override onAfterHide(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(this && this.searchContainer)
		{
			if(this.searchContainer.parentNode)
			{
				this.searchContainer.parentNode.removeChild(this.searchContainer);
			}
			this.searchContainer.style.display = 'none';
			let contextId = WidgetWithSearchBar.seenContexts.indexOf(this);
			if(contextId > -1)
			{
				window.removeEventListener('resize', WidgetWithSearchBar.resizeListeners[contextId]);
				WidgetWithSearchBar.seenContexts.splice(contextId, 1);
				WidgetWithSearchBar.resizeListeners.splice(contextId, 1);
			}
			this.searchObserver?.unobserve(this.node);
		}
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(!this.id || this.id.length === 0)
		{
			this.id = this.defaultId;
		}
		if(!this.title.className.includes(this.id))
		{
			this.title.className += ' ' + this.id;
		}
		WidgetWithSearchBar.createSearchElement(this);
		window.requestAnimationFrame(() =>
		{
			this.showSearchBar(this);
		});
	}

	protected override onBeforeDetach(msg: Message): void
	{
		if(this && this.searchContainer
			&& this.searchContainer.parentNode)
		{
			this.searchContainer.parentNode.removeChild(this.searchContainer);
		}
		this?.searchObserver?.disconnect();

		super.onBeforeDetach(msg);
	}


	protected static attachToggleIcon(context: ITabButton, renderToggle?: Function | ((toggle: HTMLElement) => void), click?: Function | ((event: PointerEvent | Event) => void)): void
	{
		// Locate the DOM node for the specific tab item
		let tabNode: HTMLElement | undefined | null;
		if(context.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`li.lm-TabBar-tab.${context.id}`) as HTMLElement;
		}
		if(!tabNode && context.node.parentElement?.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`li.lm-TabBar-tab.${context.node.parentElement.id}`) as HTMLElement;
		}
		if(!tabNode && context.node.parentElement?.parentElement?.id)
		{
			tabNode = context.node.closest('.lm-DockPanel, .lm-TabPanel')?.querySelector(`li.lm-TabBar-tab.${context.node.parentElement.parentElement.id}`) as HTMLElement;
		}
		if(!tabNode && context.parent?.id)
		{
			tabNode = this.getTabBar(context.parent);
		}
		if(!tabNode)
		{
			tabNode = this.getTabBar(context);
		}

		if(!tabNode) return;

		// Find Lumino's native close icon container
		const closeIconNode = tabNode.querySelector('.lm-TabBar-tabLabel') as HTMLElement;
		if(!closeIconNode || tabNode.querySelector('.custom-toggle-btn')) return;

		// Create custom toggle button
		context._toggleBtn = document.createElement('div');
		context._toggleBtn.className = 'lm-TabBar-tabIcon custom-toggle-btn';
		(renderToggle as any)?.apply(context, [context._toggleBtn]);
		context._toggleBtn.addEventListener('click', (event) =>
		{
			event.stopPropagation(); // Stop event bubbling to tab selection
			(click as any)?.apply(context, [event]);
			if(context._toggleBtn)
			{
				(renderToggle as any)?.apply(context, [context._toggleBtn]);
			}
		});

		// Insert toggle right before the close icon
		closeIconNode.insertAdjacentElement("afterend", context._toggleBtn);
	}

}

searchSelf.WidgetWithSearchBar = WidgetWithSearchBar;
