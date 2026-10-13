import { Message } from "@lumino/messaging";
import { Widget } from "@lumino/widgets";
import type { LuminoLayoutWindow } from "./lumino.d";
import { ISignal, Signal } from '@lumino/signaling';
import type { GlobalToolbarsWindow } from "./menu.d";

export interface WidgetExtensionsWindow
{
	SingletonSidebarWidget: typeof SingletonSidebarWidget;
	SidebarUpdateWidget: typeof SidebarUpdateWidget;
	AutoSidebarWidget: typeof AutoSidebarWidget;
	SidebarChangeWidget: typeof SidebarChangeWidget;
	WithChangingWidget: typeof WithChangingWidget;
}

const widgetSelf: WidgetExtensionsWindow & LuminoLayoutWindow & GlobalToolbarsWindow = self as unknown as any;

export class SingletonSidebarWidget extends Widget
{
	public static typedInstances: Record<string, SingletonSidebarWidget>;

	protected _failed: boolean = false;

	constructor(options?: Widget.IOptions, baseClass?: string)
	{
		if(baseClass && SingletonSidebarWidget.typedInstances[baseClass])
		{
			return SingletonSidebarWidget.typedInstances[baseClass];
		} else
		{
			super(options);
			SingletonSidebarWidget.typedInstances[this.constructor.name] = this;
		}
	}


	public processMessage(msg: Message): void
	{
		if(this._failed)
		{
			return super.processMessage(msg);
		}

		if(msg.type === 'close-request')
		{
			console.log('Intercepted close request, hiding instead: ' + this.title.label);

			this.hide();
			widgetSelf.mainDock?.layout?.removeWidget(this);
			return; // BAIL OUT: Avoid calling super.processMessage() to prevent disposal
		}

		super.processMessage(msg);
	}

}


widgetSelf.SingletonSidebarWidget = SingletonSidebarWidget;


export interface IMainpanelOptions<TMain, TItems> extends Widget.IOptions
{
	itemsChanged: ISignal<TMain, TItems>;
}

export abstract class SidebarUpdateWidget<TMain, TItems> extends SingletonSidebarWidget
{
	protected items?: TItems = undefined;
	protected _mainpanelChanged?: ISignal<TMain, TItems>;
	protected _mainpanelSub: (main: TMain, items: TItems) => void = (_, items) =>
	{
		this.items = items;
		this.filterAndRender();
	};

	protected abstract filterAndRender(): void;

	constructor(baseClass?: string, options?: IMainpanelOptions<TMain, TItems>)
	{
		super(options, baseClass);

		if(options?.itemsChanged)
		{
			this._mainpanelChanged?.disconnect(this._mainpanelSub);
			this._mainpanelChanged = options.itemsChanged;
			this._mainpanelChanged.connect(this._mainpanelSub);
		}
	}


	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.filterAndRender();
	}


	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.filterAndRender();
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		super.onBeforeDetach(msg);
	}


}

widgetSelf.SidebarUpdateWidget = SidebarUpdateWidget;


export abstract class AutoSidebarWidget<TSide extends Widget> extends Widget
{
	protected _sidebarWidget?: TSide;

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			this._sidebarWidget?.close();
		}

		super.processMessage(msg);
	}

	protected override onBeforeHide(msg: Message): void
	{
		this._sidebarWidget?.close();
		super.onBeforeHide(msg);
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._sidebarWidget?.close();
		super.onBeforeDetach(msg);
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(this._sidebarWidget && !this._sidebarWidget.isAttached)
		{
			this.openSidebar();
		}
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openSidebar();
	}

	protected openSidebar()
	{
		const that = this;
		if(!this._sidebarWidget)
		{
			return;
		}
		setTimeout(() =>
		{
			if(widgetSelf.mainDock && widgetSelf.LayoutAdjuster && that._sidebarWidget)
			{
				if(!this._sidebarWidget?.isAttached)
				{
					widgetSelf.LayoutAdjuster?.addOptimalWidgetLayout(widgetSelf.mainDock, that._sidebarWidget, {
						type: 'outline',
						projectId: that._sidebarWidget?.constructor.name
					});
				} else
				{
					this._sidebarWidget.show();
				}
			}
		}, 300);
	}
}

widgetSelf.AutoSidebarWidget = AutoSidebarWidget;



export abstract class SidebarChangeWidget<TMain, TList> extends SidebarUpdateWidget<TMain, TList[]>
{
	protected _selectedItemId?: string;

	protected _selectedItem: Signal<SidebarChangeWidget<TMain, TList>, TList> = new Signal(this);

	public get selectedItem(): ISignal<SidebarChangeWidget<TMain, TList>, TList>
	{
		return this._selectedItem;
	}

	protected _itemsChanged: Signal<SidebarChangeWidget<TMain, TList>, TList[]> = new Signal(this);

	public get itemsChanged(): ISignal<SidebarChangeWidget<TMain, TList>, TList[]>
	{
		return this._itemsChanged;
	}

}

widgetSelf.SidebarChangeWidget = SidebarChangeWidget;


export abstract class WithChangingWidget<TMain extends WithChangingWidget<TMain, TList>, TList extends Object> extends AutoSidebarWidget<SidebarChangeWidget<TMain, TList>>
{

	protected _itemsChanged: Signal<TMain, TList[]>;
	protected _selectedItemId?: string;
	protected _selectedItem?: TList;
	protected items?: TList[] = undefined;

	protected abstract filterAndRender(): void;

	constructor(title?: string, options?: IMainpanelOptions<TMain, TList[]>)
	{
		super();
		const that: TMain = this as unknown as any;
		this._itemsChanged = new Signal(that);
		// this._sidebarWidget = new SidebarChangeWidget<,>(undefined, {
		// 	itemsChanged: this._itemsChanged
		// });
	}


	private subSelected: (_: Widget, item: TList | string) => any = (_, item) =>
	{
		const t = this.items?.find(t => 'id' in t && t.id === this._selectedItemId);
		if(typeof item === 'object' && 'id' in item && typeof item.id === 'string')
		{
			this._selectedItemId = item.id;
		}
		if(t)
		{
			this.filterAndRender();
		}
	};

	private subEditing: (_: Widget, id: boolean) => any = (_, edit) =>
	{
		// this.isEditing = edit;
		// this.renderReaderPane();
	};

	private subChanged: (_: Widget, items: TList[]) => any = (_, items) =>
	{
		this.items = items;
		this.filterAndRender();
	};

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.resubscribeSidebar();
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.resubscribeSidebar();
	}

	private resubscribeSidebar()
	{
		this._sidebarWidget?.selectedItem.disconnect(this.subSelected);
		// this._sidebarWidget?.editEmail.disconnect(this.subEditing);
		this._sidebarWidget?.itemsChanged.disconnect(this.subChanged);
		this._sidebarWidget?.selectedItem.connect(this.subSelected);
		// this._sidebarWidget?.editEmail.connect(this.subEditing);
		this._sidebarWidget?.itemsChanged.connect(this.subChanged);
	}


	protected override onBeforeHide(msg: Message): void
	{
		this._sidebarWidget?.selectedItem.disconnect(this.subSelected);
		// this._sidebarWidget?.editEmail.disconnect(this.subEditing);
		this._sidebarWidget?.itemsChanged.disconnect(this.subChanged);
		this._sidebarWidget?.close();
		super.onBeforeHide(msg);
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._sidebarWidget?.selectedItem.disconnect(this.subSelected);
		// this._sidebarWidget?.editEmail.disconnect(this.subEditing);
		this._sidebarWidget?.itemsChanged.disconnect(this.subChanged);
		this._sidebarWidget?.close();
		super.onBeforeDetach(msg);
	}

}

