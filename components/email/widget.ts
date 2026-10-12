import { Message } from '@lumino/messaging';
import { Widget } from '@lumino/widgets';
import { EmailsSidebar } from './widget-sidebar';
import { ISignal, Signal } from '@lumino/signaling';
import type { GlobalToolbarsWindow, LuminoMenuWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

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
	private _emailsSidebar?: EmailsSidebar;
	private _emailsChanged: Signal<EmailWidget, EmailMessage[]> = new Signal(this);
	private isEditing: boolean = false;

	private subSelected: (_: Widget, id: string) => any = (_, id) =>
	{
		this.selectedMessageId = id;
		this.renderReaderPane();
	};
	private subEditing: (_: Widget, id: boolean) => any = (_, edit) =>
	{
		this.isEditing = edit;
		this.renderReaderPane();
	};
	private subChanged: (_: Widget, items: EmailMessage[]) => any = (_, items) =>
	{
		this.messages = items;
		this.renderReaderPane();
	};

	public get emailsChanged(): ISignal<EmailWidget, EmailMessage[]>
	{
		return this._emailsChanged;
	}

	constructor(title?: string)
	{
		super();
		this.title.label = title ?? 'Email Manager';
		this.title.iconClass = 'bx bx-envelope';
		this.title.closable = true;
		this.addClass('lumino-email-manager');
		this.initDOM();
	}


	protected onAfterAttach(): void
	{
		if(this._emailsSidebar && !this._emailsSidebar.isAttached)
		{
			this.openSidebar();
		}
		this.resubscribeSidebar();
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openSidebar();
		this.resubscribeSidebar();
	}

	private resubscribeSidebar()
	{
		this._emailsSidebar?.selectedEmail.disconnect(this.subSelected);
		// this._emailsSidebar?.editEmail.disconnect(this.subEditing);
		this._emailsSidebar?.emailsChanged.disconnect(this.subChanged);
		this._emailsSidebar?.selectedEmail.connect(this.subSelected);
		// this._emailsSidebar?.editEmail.connect(this.subEditing);
		this._emailsSidebar?.emailsChanged.connect(this.subChanged);
	}


	protected override onBeforeHide(msg: Message): void
	{
		this._emailsSidebar?.selectedEmail.disconnect(this.subSelected);
		// this._emailsSidebar?.editEmail.disconnect(this.subEditing);
		this._emailsSidebar?.emailsChanged.disconnect(this.subChanged);
		this._emailsSidebar?.close();
		super.onBeforeHide(msg);
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._emailsSidebar?.selectedEmail.disconnect(this.subSelected);
		// this._emailsSidebar?.editEmail.disconnect(this.subEditing);
		this._emailsSidebar?.emailsChanged.disconnect(this.subChanged);
		this._emailsSidebar?.close();
		super.onBeforeDetach(msg);
	}

	private openSidebar()
	{
		const that = this;
		setTimeout(() =>
		{
			if(widgetSelf.mainDock && widgetSelf.LayoutAdjuster && that._emailsSidebar)
			{
				if(!this._emailsSidebar?.isAttached)
				{
					widgetSelf.LayoutAdjuster?.addOptimalWidgetLayout(widgetSelf.mainDock, that._emailsSidebar, {
						type: 'outline',
						projectId: that._emailsSidebar?.constructor.name
					});
				}
			}
		}, 300);
	}


	public static EMPTY_MESSAGE = `
			<div class="em-empty-state">
				<i class="bx bx-paper-plane"></i>
				<p>Select a message from the sidebar.</p>
			</div>`;

	private initDOM(): void
	{
		this.id = 'emReaderPane';
		this.node.innerHTML = EmailWidget.EMPTY_MESSAGE;
		this._emailsSidebar = new EmailsSidebar(undefined, {
			emailsChanged: this.emailsChanged
		});
		this.resubscribeSidebar();

	}

	// --- DropFiles implementation for .eml / .mbox ingestion ---
	public async dropFiles(files: FileList): Promise<void>
	{
		const newMessages: EmailMessage[] = [];
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
				aiSummary: '⚡ Successfully parsed and indexed dropped email archive file.',
				isRead: false,
				isStarred: true
			};

			newMessages.push(newMsg);
		}
		this.messages.unshift(...newMessages);
		this._emailsChanged.emit(newMessages);
	}

	private renderReaderPane(): void
	{
		const msg = this.messages.find(m => m.id === this.selectedMessageId);
		if(!msg)
		{
			this.node.innerHTML = EmailWidget.EMPTY_MESSAGE;
			return;
		}

		this.node.innerHTML = `
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
                    <button class="em-btn icon" id="emStarBtn" title="Star Message"><i class="${msg.isStarred ? 'bxf bx-star starred' : 'bx bx-star'}"></i></button>
                    <button class="em-btn icon" id="emArchiveBtn" title="Archive"><i class="bx bx-archive-arrow-down"></i></button>
                    <button class="em-btn icon danger" id="emDeleteBtn" title="Delete"><i class="bx bx-trash"></i></button>
                </div>
            </div>

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
		this.node.querySelector('#emStarBtn')?.addEventListener('click', () =>
		{
			msg.isStarred = !msg.isStarred;
			this.renderReaderPane();
		});

		this.node.querySelector('#emArchiveBtn')?.addEventListener('click', () =>
		{
			msg.folder = 'archive';
			this.selectedMessageId = null;
			this._emailsChanged.emit([msg]);
			this.node.innerHTML = `<div class="em-empty-state"><i class="bx bx-paper-plane"></i><p>Transmission archived.</p></div>`;
		});

		this.node.querySelector('#emDeleteBtn')?.addEventListener('click', () =>
		{
			msg.folder = 'trash';
			this.selectedMessageId = null;
			this._emailsChanged.emit([msg]);
			this.node.innerHTML = `<div class="em-empty-state"><i class="bx bx-paper-plane"></i><p>Transmission moved to trash.</p></div>`;
		});
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
