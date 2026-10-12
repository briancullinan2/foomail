import { Widget } from '@lumino/widgets';

export interface EmailMessage
{
	id: string;
	senderName: string;
	senderEmail: string;
	avatar: string;
	subject: string;
	snippet: string;
	bodyHtml: string;
	timestamp: string;
	folder: 'inbox' | 'sent' | 'archive' | 'trash';
	aiCategory: 'Priority' | 'Newsletter' | 'Finance' | 'Security' | 'Social';
	aiSummary: string;
	isRead: boolean;
	isStarred: boolean;
}

export class EmailWidget extends Widget
{
	private messages: EmailMessage[] = [];
	private filteredMessages: EmailMessage[] = [];
	private selectedMessageId: string | null = null;
	private currentFolder: string = 'inbox';
	private currentAiFilter: string = 'all';

	// UI Elements
	private folderListEl!: HTMLElement;
	private messageListEl!: HTMLElement;
	private readerPaneEl!: HTMLElement;
	private searchInput!: HTMLInputElement;

	constructor(title?: string)
	{
		super();
		this.title.label = title ?? 'Email Manager';
		this.title.iconClass = 'bx bx-envelope';
		this.addClass('lumino-email-manager');
		this.initDOM();
		this.loadStellarDemoData();
	}

	private initDOM(): void
	{
		this.node.innerHTML = `
            <div class="em-layout">
                <!-- Left Sidebar: Folders & AI Smart Filters -->
                <div class="em-sidebar">
                    <div class="em-sidebar-header">
                        <h2><i class="bx bx-envelope"></i> Nexus Mail</h2>
                        <button id="emComposeBtn" class="em-btn primary" title="New Message"><i class="bx bx-edit"></i></button>
                    </div>

                    <div class="em-folder-section">
                        <span class="em-section-title">Folders</span>
                        <div class="em-nav-item active" data-folder="inbox"><i class="bx bx-inbox"><span>Inbox</span></i><span class="em-badge" id="inboxCount">0</span></div>
                        <div class="em-nav-item" data-folder="sent"><i class="bx bx-send"><span>Sent</span></i></div>
                        <div class="em-nav-item" data-folder="archive"><i class="bx bx-archive"><span>Archive</span></i></div>
                        <div class="em-nav-item" data-folder="trash"><i class="bx bx-trash"><span>Trash</span></i></div>
                    </div>

                    <div class="em-folder-section ai-filters">
                        <span class="em-section-title"><i class="bx bx-brain"></i> AI Autonomous Sort</span>
                        <div class="em-ai-pill active" data-ai="all">All Stream</div>
                        <div class="em-ai-pill" data-ai="Priority"><i class="bx bx-bolt"></i> Priority</div>
                        <div class="em-ai-pill" data-ai="Finance"><i class="bx bx-dollar-circle"></i> Finance</div>
                        <div class="em-ai-pill" data-ai="Security"><i class="bx bx-shield-quarter"></i> Security</div>
                        <div class="em-ai-pill" data-ai="Newsletter"><i class="bx bx-news"></i> Newsletters</div>
                    </div>
                </div>

                <!-- Middle Pane: Message List -->
                <div class="em-list-pane">
                    <div class="em-search-bar">
                        <i class="bx bx-search"></i>
                        <input type="text" id="emSearchInput" placeholder="Search SOCKS5 stream or AI index..." />
                    </div>
                    <div class="em-message-items" id="emMessageItems">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Right/Center Pane: Reader & AI Summary HUD -->
                <div class="em-reader-pane" id="emReaderPane">
                    <div class="em-empty-state">
                        <i class="bx bx-paper-plane"></i>
                        <p>Select a transmission from the stream to inspect markup and AI insights.</p>
                    </div>
                </div>
            </div>
        `;

		// Cache elements
		this.folderListEl = this.node.querySelector('.em-sidebar') as HTMLElement;
		this.messageListEl = this.node.querySelector('#emMessageItems') as HTMLElement;
		this.readerPaneEl = this.node.querySelector('#emReaderPane') as HTMLElement;
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

		this.updateBadgeCounts();
		this.filterAndRender();
	}

	// --- DropFiles implementation for .eml / .mbox ingestion ---
	public async dropFiles(files: FileList): Promise<void>
	{
		for(let i = 0; i < files.length; i++)
		{
			const file = files[i];
			const content = await file.text();

			const newMsg: EmailMessage = {
				id: 'drop-' + Math.random().toString(36).substr(2, 9),
				senderName: file.name,
				senderEmail: 'imported@local.stream',
				avatar: 'I',
				subject: `Ingested Archive: ${file.name}`,
				snippet: content.substring(0, 100) + '...',
				bodyHtml: `<pre>${this.escapeHTML(content)}</pre>`,
				timestamp: 'Just now',
				folder: 'inbox',
				aiCategory: 'Priority',
				aiSummary: '⚡ AI successfully parsed and indexed dropped email archive file.',
				isRead: false,
				isStarred: true
			};

			this.messages.unshift(newMsg);
		}
		this.updateBadgeCounts();
		this.filterAndRender();
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
				this.renderReaderPane();
			});
			this.messageListEl.appendChild(card);
		});
	}

	private renderReaderPane(): void
	{
		const msg = this.messages.find(m => m.id === this.selectedMessageId);
		if(!msg)
		{
			this.readerPaneEl.innerHTML = `
                <div class="em-empty-state">
                    <i class="bx bx-paper-plane"></i>
                    <p>Select a transmission from the stream to inspect markup and AI insights.</p>
                </div>`;
			return;
		}

		this.readerPaneEl.innerHTML = `
            <div class="em-reader-header">
                <div class="em-reader-meta">
                    <h2>${this.escapeHTML(msg.subject)}</h2>
                    <div class="em-sender-details">
                        <div class="em-avatar lg">${msg.avatar}</div>
                        <div>
                            <strong>${this.escapeHTML(msg.senderName)}</strong>
                            <span>&lt;${this.escapeHTML(msg.senderEmail)}&gt;</span>
                        </div>
                    </div>
                </div>
                <div class="em-reader-actions">
                    <button class="em-btn icon" id="emStarBtn" title="Star Message"><i class="bx ${msg.isStarred ? 'bxs-star starred' : 'bx-star'}"></i></button>
                    <button class="em-btn icon" id="emArchiveBtn" title="Archive"><i class="bx bx-archive-in"></i></button>
                    <button class="em-btn icon danger" id="emDeleteBtn" title="Delete"><i class="bx bx-trash"></i></button>
                </div>
            </div>

            <!-- Autonomous AI Summary HUD Banner -->
            <div class="em-ai-hud">
                <div class="em-hud-header">
                    <i class="bx bx-brain"></i>
                    <span>Autonomous AI Briefing & Classification</span>
                </div>
                <p>${this.escapeHTML(msg.aiSummary)}</p>
            </div>

            <div class="em-reader-body">
                ${msg.bodyHtml}
            </div>
        `;

		// Bind Reader Actions
		this.readerPaneEl.querySelector('#emStarBtn')?.addEventListener('click', () =>
		{
			msg.isStarred = !msg.isStarred;
			this.renderReaderPane();
		});

		this.readerPaneEl.querySelector('#emArchiveBtn')?.addEventListener('click', () =>
		{
			msg.folder = 'archive';
			this.selectedMessageId = null;
			this.updateBadgeCounts();
			this.filterAndRender();
			this.readerPaneEl.innerHTML = `<div class="em-empty-state"><i class="bx bx-paper-plane"></i><p>Transmission archived.</p></div>`;
		});

		this.readerPaneEl.querySelector('#emDeleteBtn')?.addEventListener('click', () =>
		{
			msg.folder = 'trash';
			this.selectedMessageId = null;
			this.updateBadgeCounts();
			this.filterAndRender();
			this.readerPaneEl.innerHTML = `<div class="em-empty-state"><i class="bx bx-paper-plane"></i><p>Transmission moved to trash.</p></div>`;
		});
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
