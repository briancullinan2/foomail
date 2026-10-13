

// ============================================================================
// Lumino ThreadListWidget Component
// ============================================================================

import { Widget } from "@lumino/widgets";
import type { ChatStorageEngine } from "./widget-storage";
import { Signal } from "@lumino/signaling";
import type { IThreadMeta } from "./widget";
import { Message } from "@lumino/messaging";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { WidgetExtensionsWindow } from "../bundle/widget-extensions";

const threadsSelf: LuminoLayoutWindow & WidgetExtensionsWindow = self as unknown as any;

export class ThreadListWidget extends threadsSelf.SingletonSidebarWidget
{
	public readonly threadSelected = new Signal<this, string>(this);
	public readonly newThreadRequested = new Signal<this, void>(this);
	public readonly threadDeleted = new Signal<this, string>(this);

	private storage: ChatStorageEngine;
	private threads: IThreadMeta[] = [];
	private activeThreadId: string | null = null;

	private listContainer?: HTMLDivElement;

	constructor(storage: ChatStorageEngine, options?: Widget.IOptions)
	{
		super(options, ThreadListWidget.name);
		this.storage = storage;
		this.id = 'lumino-thread-list-widget';
		this.title.label = 'Threads';
		this.title.closable = true;

		this.addClass('lm-ThreadListWidget');
		this.buildDOM();
	}


	private buildDOM(): void
	{
		this.node.style.display = 'flex';
		this.node.style.flexDirection = 'column';
		this.node.style.height = '100%';
		this.node.style.width = '100%';
		this.node.style.backgroundColor = '#1e1e1e';
		this.node.style.color = '#cccccc';
		this.node.style.fontFamily = 'system-ui, -apple-system, sans-serif';

		// Header / New Thread Button
		const header = document.createElement('div');
		header.style.padding = '12px';
		header.style.borderBottom = '1px solid #333';
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';

		// const title = document.createElement('span');
		// title.innerText = 'Conversations';
		// title.style.fontWeight = 'bold';

		const newBtn = document.createElement('button');
		newBtn.innerText = '+ New Thread';
		newBtn.style.padding = '6px 12px';
		newBtn.style.backgroundColor = '#007acc';
		newBtn.style.color = '#fff';
		newBtn.style.border = 'none';
		newBtn.style.borderRadius = '4px';
		newBtn.style.cursor = 'pointer';
		newBtn.onclick = () => this.newThreadRequested.emit();

		// header.appendChild(title);
		header.appendChild(newBtn);
		this.node.appendChild(header);

		// List Container
		this.listContainer = document.createElement('div');
		this.listContainer.style.flex = '1';
		this.listContainer.style.overflowY = 'auto';
		this.node.appendChild(this.listContainer);
	}

	public async refresh(activeId?: string): Promise<void>
	{
		if(activeId !== undefined)
		{
			this.activeThreadId = activeId;
		}
		this.threads = await this.storage.getAllThreads();
		this.render();
	}

	private render(): void
	{
		if(this.listContainer)
		{
			this.listContainer.innerHTML = '';
		}
		if(this.threads.length === 0)
		{
			const empty = document.createElement('div');
			empty.innerText = 'No conversations yet.';
			empty.style.padding = '16px';
			empty.style.color = '#666';
			empty.style.textAlign = 'center';
			this.listContainer?.appendChild(empty);
			return;
		}

		for(const thread of this.threads)
		{
			const item = document.createElement('div');
			item.style.padding = '10px 12px';
			item.style.borderBottom = '1px solid #2a2a2a';
			item.style.cursor = 'pointer';
			item.style.display = 'flex';
			item.style.justifyContent = 'space-between';
			item.style.alignItems = 'center';

			if(thread.path === this.activeThreadId)
			{
				item.style.backgroundColor = '#37373d';
			} else
			{
				item.onmouseenter = () => (item.style.backgroundColor = '#2a2d2e');
				item.onmouseleave = () => (item.style.backgroundColor = 'transparent');
			}

			const infoDiv = document.createElement('div');
			infoDiv.style.overflow = 'hidden';
			infoDiv.style.flex = '1';

			const tTitle = document.createElement('div');
			tTitle.innerText = thread.contents || 'Untitled Thread';
			tTitle.style.fontWeight = '500';
			tTitle.style.whiteSpace = 'nowrap';
			tTitle.style.overflow = 'hidden';
			tTitle.style.textOverflow = 'ellipsis';

			const sub = document.createElement('div');
			sub.innerText = `${thread.size} msgs • ${new Date(thread.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
			sub.style.fontSize = '11px';
			sub.style.color = '#888';
			sub.style.marginTop = '4px';

			infoDiv.appendChild(tTitle);
			infoDiv.appendChild(sub);

			const delBtn = document.createElement('button');
			delBtn.innerText = '✕';
			delBtn.style.background = 'none';
			delBtn.style.border = 'none';
			delBtn.style.color = '#888';
			delBtn.style.cursor = 'pointer';
			delBtn.style.padding = '4px 8px';
			delBtn.onclick = (e) =>
			{
				e.stopPropagation();
				this.threadDeleted.emit(thread.path);
			};

			item.onclick = () =>
			{
				this.activeThreadId = thread.path;
				this.render();
				this.threadSelected.emit(thread.path);
			};

			item.appendChild(infoDiv);
			item.appendChild(delBtn);
			this.listContainer?.appendChild(item);
		}
	}
}
