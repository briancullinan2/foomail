import { EmailsSidebar } from './widget-sidebar';
import type { GlobalToolbarsWindow, LuminoMenuWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import type { IMainpanelOptions, WidgetExtensionsWindow } from '../bundle/widget-extensions';
import { Widget } from '@lumino/widgets';

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& WidgetExtensionsWindow = self as unknown as any;

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

export class EmailWidget extends widgetSelf.WithChangingWidget<EmailWidget, EmailMessage>
{
	private filteredMessages: EmailMessage[] = [];
	private currentFolder: string = 'inbox';
	private currentAiFilter: string = 'all';


	constructor(title?: string, options?: IMainpanelOptions<EmailWidget, EmailMessage[]>)
	{
		super(title, options);
		this.addClass('lumino-email-manager');
		this.initDOM();
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
		this._sidebarWidget = new EmailsSidebar(undefined, {
			itemsChanged: this.itemsChanged
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
		this.items?.unshift(...newMessages);
		this._itemsChanged.emit(newMessages);
	}

	protected filterAndRender(): void
	{
		const msg = this.items?.find(m => m.id === this._selectedItemId);
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
			this.filterAndRender();
		});

		this.node.querySelector('#emArchiveBtn')?.addEventListener('click', () =>
		{
			msg.folder = 'archive';
			this._selectedItemId = undefined;
			this._itemsChanged.emit([msg]);
			this.node.innerHTML = `<div class="em-empty-state"><i class="bx bx-paper-plane"></i><p>Transmission archived.</p></div>`;
		});

		this.node.querySelector('#emDeleteBtn')?.addEventListener('click', () =>
		{
			msg.folder = 'trash';
			this._selectedItemId = undefined;
			this._itemsChanged.emit([msg]);
			this.node.innerHTML = `<div class="em-empty-state"><i class="bx bx-paper-plane"></i><p>Transmission moved to trash.</p></div>`;
		});
	}

}
