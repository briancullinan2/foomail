import { Widget } from '@lumino/widgets';
import type { IMainpanelOptions, WidgetExtensionsWindow } from '../bundle/widget-extensions';
import { Message } from '@lumino/messaging';
import { NotesSidebar } from './widget-sidebar';

export interface JournalEntry
{
	id: string;
	title: string;
	timestamp: string;
	mood: 'SYSTEM_STABLE' | 'NEURAL_OVERLOAD' | 'DEEP_FOCUS' | 'CRITICAL_BUG';
	tags: string[];
	content: string;
	wordCount: number;
}

const widgetSelf: WidgetExtensionsWindow = self as unknown as any;

export class NotesWidget extends widgetSelf.WithChangingWidget<NotesWidget, JournalEntry>
{
	private isPreviewMode: boolean = false;

	// UI Elements
	private editorEl!: HTMLTextAreaElement;
	private previewEl!: HTMLElement;
	private titleInput!: HTMLInputElement;
	private moodSelect!: HTMLSelectElement;
	private tagsInput!: HTMLInputElement;
	private wordCountEl!: HTMLElement;
	private charCountEl!: HTMLElement;
	private timeStampEl!: HTMLElement;

	constructor(title?: string, options?: IMainpanelOptions<NotesWidget, JournalEntry[]>)
	{
		super(title, options);
		this.addClass('lumino-terminal-journal');
		this.initDOM();
	}

	private initDOM(): void
	{
		this.addClass('tj-container');
		this.node.innerHTML = `
			<div class="tj-header-bar">
				<button id="tjNewLogBtn" class="tj-btn primary"><i class="bx bx-plus-circle"></i> NEW_LOG</button>
				<button id="tjTogglePreviewBtn" class="tj-btn"><i class="bx bx-code-alt"></i> TOGGLE_VIEW</button>
				<button id="tjTimestampBtn" class="tj-btn"><i class="bx bx-time-five"></i> INJECT_STAMP</button>
				<button id="tjExportBtn" class="tj-btn"><i class="bx bx-download"></i> EXPORT_LOGS</button>
			</div>

			<div class="tj-workspace">
				<div class="tj-metadata-strip">
					<input type="text" id="tjTitleInput" placeholder="ENTRY_TITLE..." />
					<select id="tjMoodSelect">
						<option value="SYSTEM_STABLE">⚡ SYSTEM_STABLE</option>
						<option value="DEEP_FOCUS">🎯 DEEP_FOCUS</option>
						<option value="NEURAL_OVERLOAD">⚠️ NEURAL_OVERLOAD</option>
						<option value="CRITICAL_BUG">🔥 CRITICAL_BUG</option>
					</select>
					<input type="text" id="tjTagsInput" placeholder="TAGS (comma separated)..." />
				</div>

				<!-- Editor & Preview Frames -->
				<div class="tj-editor-wrapper">
					<textarea id="tjEditor" placeholder="// Initialize thoughts... Markdown supported..."></textarea>
					<div id="tjPreview" class="tj-preview-pane hidden"></div>
				</div>

				<!-- Telemetry Footer Bar -->
				<div class="tj-telemetry-bar">
					<span>WORDS: <strong id="tjWordCount">0</strong></span>
					<span>CHARS: <strong id="tjCharCount">0</strong></span>
					<span>LAST_UPDATED: <strong id="tjTimestamp">--:--:--</strong></span>
					<span class="tj-ascii-pulse">█▒▒▒▒▒▒▒▒▒</span>
				</div>
			</div>`;

		// Cache elements
		this.editorEl = this.node.querySelector('#tjEditor') as HTMLTextAreaElement;
		this.previewEl = this.node.querySelector('#tjPreview') as HTMLElement;
		this.titleInput = this.node.querySelector('#tjTitleInput') as HTMLInputElement;
		this.moodSelect = this.node.querySelector('#tjMoodSelect') as HTMLSelectElement;
		this.tagsInput = this.node.querySelector('#tjTagsInput') as HTMLInputElement;
		this.wordCountEl = this.node.querySelector('#tjWordCount') as HTMLElement;
		this.charCountEl = this.node.querySelector('#tjCharCount') as HTMLElement;
		this.timeStampEl = this.node.querySelector('#tjTimestamp') as HTMLElement;

		// Bind events
		this.node.querySelector('#tjNewLogBtn')?.addEventListener('click', () => this.createNewEntry());
		this.node.querySelector('#tjTogglePreviewBtn')?.addEventListener('click', () => this.togglePreview());
		this.node.querySelector('#tjTimestampBtn')?.addEventListener('click', () => this.injectTimestamp());
		this.node.querySelector('#tjExportBtn')?.addEventListener('click', () => this.exportAllLogs());

		this.editorEl.addEventListener('input', () => this.handleEditorInput());
		this.titleInput.addEventListener('input', () => this.saveCurrentState());
		this.moodSelect.addEventListener('change', () => this.saveCurrentState());
		this.tagsInput.addEventListener('input', () => this.saveCurrentState());

		this._sidebarWidget = new NotesSidebar(undefined, {
			itemsChanged: this.itemsChanged
		});
	}


	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.loadDefaultLogs();
	}


	private loadDefaultLogs(): void
	{
		this.items = [
			{
				id: 'log-1',
				title: 'Initial Neural Dump',
				timestamp: new Date().toLocaleString(),
				mood: 'DEEP_FOCUS',
				tags: ['journal', 'lumino', 'webassembly'],
				content: `# CYBERPUNK JOURNAL LOG 0x01\n\n* **System Status:** All green.\n* **Objective:** Building high-speed client tools in WebWorker threads.\n\n### Core Notes:\n- Lumino widgets offer complete structural isolation.\n- IndexedDB local storage ensures offline access.\n- Remember to patch memory leaks on demuxing operations.\n\n\`\`\`javascript\nconsole.log("System initialization complete.");\n\`\`\``,
				wordCount: 42
			}
		];

		this._selectedItemId = this.items[0].id;
		this._itemsChanged.emit(this.items);
		this.filterAndRender();
	}

	// --- DropFiles implementation for .md / .txt / .json logs ---
	public async dropFiles(files: FileList): Promise<void>
	{
		for(let i = 0; i < files.length; i++)
		{
			const file = files[i];
			const content = await file.text();

			const newEntry: JournalEntry = {
				id: 'drop-' + Math.random().toString(36).substring(2, 9),
				title: file.name.replace(/\.[^/.]+$/, ""),
				timestamp: new Date().toLocaleString(),
				mood: 'SYSTEM_STABLE',
				tags: ['dropped-import', file.name.split('.').pop() || 'txt'],
				content: content,
				wordCount: content.trim().split(/\s+/).length
			};

			this.items?.unshift(newEntry);
		}

		this._itemsChanged.emit(this.items ?? []);
		if(files.length > 0)
		{
			this._selectedItemId = this.items?.[0].id;
			this.filterAndRender();
		}
	}

	protected filterAndRender(): void
	{
		const entry = this.items?.find(e => e.id === this._selectedItemId);
		if(!entry) return;

		this.titleInput.value = entry.title;
		this.moodSelect.value = entry.mood;
		this.tagsInput.value = entry.tags.join(', ');
		this.editorEl.value = entry.content;
		this.updateTelemetry();
		if(this.isPreviewMode) this.updatePreviewHTML();
	}

	private createNewEntry(): void
	{
		const newEntry: JournalEntry = {
			id: 'log-' + Math.random().toString(36).substring(2, 9),
			title: `Log Entry 0x${Math.floor(Math.random() * 1000).toString(16)}`,
			timestamp: new Date().toLocaleString(),
			mood: 'SYSTEM_STABLE',
			tags: ['raw'],
			content: '',
			wordCount: 0
		};
		this.items?.unshift(newEntry);
		this._selectedItemId = newEntry.id;
		this._selectedItem = newEntry;
		this._itemsChanged.emit([newEntry]);
		this.filterAndRender();
	}

	private handleEditorInput(): void
	{
		this.saveCurrentState();
		this.updateTelemetry();
		if(this.isPreviewMode) this.updatePreviewHTML();
	}

	private saveCurrentState(): void
	{
		const entry = this.items?.find(e => e.id === this._selectedItemId);
		if(!entry) return;

		entry.title = this.titleInput.value || 'Untitled Log';
		entry.mood = this.moodSelect.value as any;
		entry.tags = this.tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
		entry.content = this.editorEl.value;
		entry.wordCount = entry.content.trim() ? entry.content.trim().split(/\s+/).length : 0;
		entry.timestamp = new Date().toLocaleString();

		this.timeStampEl.textContent = entry.timestamp;
		this._itemsChanged.emit([entry]);
		// TODO: Update item in list sidebar without losing scroll
		//const listTitleEl = this.entryListEl.querySelector(`.tj-log-item.selected .tj-item-title`);
		//if(listTitleEl) listTitleEl.textContent = entry.title;
	}

	private updateTelemetry(): void
	{
		const content = this.editorEl.value;
		const words = content.trim() ? content.trim().split(/\s+/).length : 0;
		this.wordCountEl.textContent = words.toString();
		this.charCountEl.textContent = content.length.toString();
	}

	private togglePreview(): void
	{
		this.isPreviewMode = !this.isPreviewMode;
		if(this.isPreviewMode)
		{
			this.editorEl.classList.add('hidden');
			this.previewEl.classList.remove('hidden');
			this.updatePreviewHTML();
		} else
		{
			this.previewEl.classList.add('hidden');
			this.editorEl.classList.remove('hidden');
		}
	}

	private updatePreviewHTML(): void
	{
		// Simple Markdown parser renderer fallback
		let raw = this.escapeHTML(this.editorEl.value);
		raw = raw.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		raw = raw.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		raw = raw.replace(/^# (.*$)/gim, '<h1>$1</h1>');
		raw = raw.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
		raw = raw.replace(/\*(.*)\*/gim, '<em>$1</em>');
		raw = raw.replace(/`(.*)`/gim, '<code>$1</code>');
		raw = raw.replace(/\n/gim, '<br>');
		this.previewEl.innerHTML = raw;
	}

	private injectTimestamp(): void
	{
		const stamp = `\n\n[STAMP: ${new Date().toISOString()}]\n`;
		this.editorEl.value += stamp;
		this.handleEditorInput();
	}

	private exportAllLogs(): void
	{
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.items, null, 2));
		const a = document.createElement('a');
		a.href = dataStr;
		a.download = `nexus_journal_backup_${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

}
