import { Widget } from "@lumino/widgets";
import type { EmailMessage, EmailWidget } from "./widget";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";

export interface IEmailsOptions
{
	emailsChanged: ISignal<EmailWidget, EmailMessage[]>;
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

export class EmailsSidebar extends Widget
{
	private folderListEl!: HTMLElement;
	private messageListEl!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private messages: EmailMessage[] = [];
	private filteredMessages: EmailMessage[] = [];
	private selectedMessageId: string | null = null;
	private currentFolder: string = 'inbox';
	private currentAiFilter: string = 'all';

	private _selectedEmail: Signal<EmailsSidebar, string> = new Signal(this);

	public get selectedEmail(): ISignal<EmailsSidebar, string>
	{
		return this._selectedEmail;
	}

	// private _editEmail: Signal<EmailsSidebar, boolean> = new Signal(this);

	// public get editEmail(): ISignal<EmailsSidebar, boolean>
	// {
	// 	return this._editEmail;
	// }

	private _emailsChanged: Signal<EmailsSidebar, EmailMessage[]> = new Signal(this);

	public get emailsChanged(): ISignal<EmailsSidebar, EmailMessage[]>
	{
		return this._emailsChanged;
	}

	private _mainpanelChanged?: ISignal<EmailWidget, EmailMessage[]>;
	private _mainpanelSub: (main: EmailWidget, items: EmailMessage[]) => void = (_, items) =>
	{
		this.messages = items;
		this.updateBadgeCounts();
		this.filterAndRender();
	};


	constructor(title?: string, options?: IEmailsOptions)
	{
		super();
		this.title.label = 'Messages';
		this.title.iconClass = 'bx bx-card-view-tiles';
		this.title.closable = true;
		if(options?.emailsChanged)
		{
			this._mainpanelChanged = options.emailsChanged;
			this._mainpanelChanged.connect(this._mainpanelSub);
		}
		this.initDom();
		// this.loadStellarDemoData();
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
		this.loadStellarDemoData();
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.updateBadgeCounts();
		this.filterAndRender();
	}


	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.updateBadgeCounts();
		this.filterAndRender();
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		super.onBeforeDetach(msg);
	}


	private initDom()
	{
		this.node.innerHTML = `
			<div class="em-search-bar">
				<i class="bx bx-search"></i>
				<input type="text" id="emSearchInput" placeholder="Search Emails..." />
				<button id="emComposeBtn" class="em-btn primary" title="New Message"><i class="bx bx-edit"></i></button>
			</div>

			<div class="em-folder-section">
				<div class="em-nav-item" data-folder="notifications"><i class="bx bx-bell-ring"></i><span>Notifications</span></div>
				<div class="em-nav-item active" data-folder="inbox"><i class="bx bx-inbox"></i><span>Inbox</span><span class="em-badge" id="inboxCount">0</span></div>
				<div class="em-nav-item" data-folder="sent"><i class="bx bx-send"></i><span>Sent</span></div>
				<div class="em-nav-item" data-folder="archive"><i class="bx bx-archive"></i><span>Archive</span></div>
				<div class="em-nav-item" data-folder="trash"><i class="bx bx-trash"></i><span>Trash</span></div>
			</div>

			<div class="em-message-items" id="emMessageItems">
				<!-- Populated dynamically -->
			</div>`;
		this.folderListEl = this.node.querySelector('.em-sidebar') as HTMLElement;
		this.messageListEl = this.node.querySelector('#emMessageItems') as HTMLElement;
		this.searchInput = this.node.querySelector('#emSearchInput') as HTMLInputElement;


		// Bind folder navigation events
		this.node.querySelectorAll('.em-nav-item').forEach(el =>
		{
			el.addEventListener('click', (e) =>
			{
				this.node.querySelectorAll('.em-nav-item').forEach(i => i.classList.remove('active'));
				const target = (e.currentTarget as HTMLElement);
				target.classList.add('active');
				this.currentFolder = target.getAttribute('data-folder') || 'inbox';
				this.filterAndRender();
			});
		});

		// Bind AI pill filters
		this.node.querySelectorAll('.em-ai-pill').forEach(el =>
		{
			el.addEventListener('click', (e) =>
			{
				this.node.querySelectorAll('.em-ai-pill').forEach(i => i.classList.remove('active'));
				const target = (e.currentTarget as HTMLElement);
				target.classList.add('active');
				this.currentAiFilter = target.getAttribute('data-ai') || 'all';
				this.filterAndRender();
			});
		});

		this.searchInput.addEventListener('input', () => this.filterAndRender());
	}

	private filterAndRender(): void
	{
		const query = this.searchInput.value.toLowerCase();

		this.filteredMessages = this.messages.filter(m =>
		{
			const matchesFolder = m.folder === this.currentFolder;
			const matchesAi = this.currentAiFilter === 'all' || m.aiCategory === this.currentAiFilter;
			const matchesQuery = m.subject.toLowerCase().includes(query) ||
				m.senderName.toLowerCase().includes(query) ||
				m.snippet.toLowerCase().includes(query);
			return matchesFolder && matchesAi && matchesQuery;
		});

		this.renderMessageList();
	}

	private updateBadgeCounts(): void
	{
		const unreadCount = this.messages.filter(m => !m.isRead && m.folder === 'inbox').length;
		const badge = this.node.querySelector('#inboxCount');
		if(badge)
		{
			badge.textContent = unreadCount > 0 ? unreadCount.toString() : '';
		}
	}

	private renderMessageList(): void
	{
		this.messageListEl.innerHTML = '';
		if(this.filteredMessages.length === 0)
		{
			this.messageListEl.innerHTML = `<div class="em-empty-list">No transmissions in this sector</div>`;
			return;
		}

		this.filteredMessages.forEach(m =>
		{
			const isSelected = m.id === this.selectedMessageId;
			const card = document.createElement('div');
			card.className = `em-message-card ${m.isRead ? '' : 'unread'} ${isSelected ? 'selected' : ''}`;
			card.innerHTML = `
                <div class="em-avatar">${m.avatar}</div>
                <div class="em-message-preview">
                    <div class="em-preview-top">
                        <span class="em-sender">${this.escapeHTML(m.senderName)}</span>
                        <span class="em-time">${m.timestamp}</span>
                    </div>
                    <span class="em-subject">${this.escapeHTML(m.subject)}</span>
                    <span class="em-snippet">${this.escapeHTML(m.snippet)}</span>
                    <div class="em-ai-tag-row">
                        <span class="em-ai-badge ${m.aiCategory.toLowerCase()}">${m.aiCategory}</span>
                    </div>
                </div>
            `;
			card.addEventListener('click', () =>
			{
				m.isRead = true;
				this.selectedMessageId = m.id;
				this.updateBadgeCounts();
				this.renderMessageList();
				this._selectedEmail.emit(m.id);
			});
			this.messageListEl.appendChild(card);
		});
	}

	private loadStellarDemoData(): void
	{
		this.messages = [
			{
				id: 'msg-1',
				senderName: 'GitHub Enterprise',
				senderEmail: 'notifications@github.com',
				avatar: 'G',
				subject: '[Security Advisory] Critical WebAssembly Memory Leak in Worker Thread',
				snippet: 'A potential memory allocation vector was identified in your Web Worker DuckDB-Wasm bindings...',
				bodyHtml: `<p>Hello Brian,</p><p>A potential memory allocation vector was identified in your Web Worker <strong>DuckDB-Wasm</strong> bindings across the <code>pryor.games</code> cluster.</p><p>Recommended action: Update your thread initialization parameters and patch memory buffers.</p>`,
				timestamp: '10:42 AM',
				folder: 'inbox',
				aiCategory: 'Security',
				aiSummary: '⚡ Critical security alert regarding WebAssembly worker memory allocation. Immediate patch recommended.',
				isRead: false,
				isStarred: true
			},
			{
				id: 'msg-2',
				senderName: 'Squarespace Billing',
				senderEmail: 'billing@squarespace.com',
				avatar: 'S',
				subject: 'Auto-Renewal Notice: quake.games & briancullinan.com domain registration',
				snippet: 'Your upcoming annual domain renewal for quake.games is scheduled for automatic billing...',
				bodyHtml: `<p>Your annual domain renewal for <strong>quake.games</strong> and <strong>briancullinan.com</strong> is scheduled for processing through your connected payment vault.</p><p>Amount: $20.00 / domain</p>`,
				timestamp: '9:15 AM',
				folder: 'inbox',
				aiCategory: 'Finance',
				aiSummary: '🤖 Automated renewal notice for quake.games and briancullinan.com. No action needed.',
				isRead: true,
				isStarred: false
			},
			{
				id: 'msg-3',
				senderName: 'SixDegrees Foundation',
				senderEmail: 'contact@sixdegrees.org',
				avatar: '6',
				subject: 'Follow-up on June 18 Connectivity Topology Discussion',
				snippet: 'Thank you for reaching out regarding our connectivity theories and network graph scaling...',
				bodyHtml: `<p>Hi Brian,</p><p>We reviewed your notes on Lumino layout nodes interacting with decentralized graph topology. Our team would love to schedule a briefing.</p>`,
				timestamp: 'Yesterday',
				folder: 'inbox',
				aiCategory: 'Priority',
				aiSummary: '⚡ High-priority partnership inquiry from SixDegrees regarding Lumino graph topologies.',
				isRead: false,
				isStarred: true
			},
			{
				id: 'msg-4',
				senderName: 'Claude Code Release Notes',
				senderEmail: 'updates@anthropic.com',
				avatar: 'A',
				subject: 'New release: Local Model Execution & WebGPU Acceleration',
				snippet: 'Explore our latest benchmarks for running Qwen2.5-Coder directly inside browser environments...',
				bodyHtml: `<p>Discover how WebGPU tensor kernels enable blazing fast local AI code completion inside your client applications.</p>`,
				timestamp: 'Oct 9',
				folder: 'inbox',
				aiCategory: 'Newsletter',
				aiSummary: '🤖 Curated developer dispatch highlighting WebGPU local code generation benchmarks.',
				isRead: true,
				isStarred: false
			}
		];

		this._emailsChanged.emit(this.messages);
		this.updateBadgeCounts();
		this.filterAndRender();
	}


	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}


