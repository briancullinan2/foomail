import { Widget } from "@lumino/widgets";
import type { CredentialRecord, CredentialType, KeystoreWidget } from "./widget";
import { KeyParser } from "./key-parser";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";


export interface IPasswordOptions
{
	passwordsChanged: ISignal<KeystoreWidget, CredentialRecord[]>;
}



const widgetSelf: LuminoLayoutWindow
	= self as unknown as any;


export class PasswordsSidebar extends Widget
{
	private searchInput!: HTMLInputElement;
	private typeFilterSelect!: HTMLSelectElement;
	private credentialListEl!: HTMLElement;
	private filteredCredentials: CredentialRecord[] = [];
	private selectedCredentialId: string | null = null;
	private credentials: CredentialRecord[] = [];

	private _selectedPassword: Signal<PasswordsSidebar, CredentialRecord> = new Signal(this);
	static _instance?: PasswordsSidebar;

	public get selectedPassword(): ISignal<PasswordsSidebar, CredentialRecord>
	{
		return this._selectedPassword;
	}

	private _passwordsChanged: Signal<PasswordsSidebar, CredentialRecord[]> = new Signal(this);
	public get passwordsChanged(): ISignal<PasswordsSidebar, CredentialRecord[]> { return this._passwordsChanged; }

	private _createPassword: Signal<PasswordsSidebar, CredentialType> = new Signal(this);
	public get createPassword(): ISignal<PasswordsSidebar, CredentialType> { return this._createPassword; }

	private _mainpanelChanged?: ISignal<KeystoreWidget, CredentialRecord[]>;
	private _mainpanelSub: (main: KeystoreWidget, items: CredentialRecord[]) => void = (_, items) =>
	{
		this.credentials = items;
		this.filterAndRenderList();
	};

	constructor(title?: string, options?: IPasswordOptions)
	{
		if(!PasswordsSidebar._instance)
		{
			super();
			PasswordsSidebar._instance = this;
			this.title.label = title ?? 'Passwords';
			this.title.iconClass = 'bx bx-card-view-tiles';
			this.title.closable = true;
			this.initDOM();
		}
		if(options?.passwordsChanged)
		{
			PasswordsSidebar._instance._mainpanelChanged = options.passwordsChanged;
			PasswordsSidebar._instance._mainpanelChanged.connect(PasswordsSidebar._instance._mainpanelSub);
		}
		return PasswordsSidebar._instance;
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			this.hide();
			widgetSelf.mainDock?.layout?.removeWidget(this);
			return;
		}
		super.processMessage(msg);
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderListUI();
	}


	private initDOM(): void
	{
		this.node.innerHTML = `
			<div class="pwm-search-bar">
				<div class="pwm-search-input-wrap">
					<i class="bx bx-search"></i>
					<input type="text" id="pwmSearchInput" placeholder="Filter passwords & forms..." />
				</div>
				<button id="pwmAddBtn" title="Add New Item"><i class="bx bx-plus"></i></button>
				<select id="pwmTypeFilter">
					<option value="all">All Types</option>
					<option value="login">Logins</option>
					<option value="apikey">API Keys</option>
					<option value="securenote">Notes</option>
					<option value="card">Cards</option>
					<option value="ssh">SSH Keys</option>
				</select>
				<button id="pwmExportBtn" title="Export All"><i class="bx bx-archive-arrow-down"></i></button>
			</div>

			<!-- Drag & Drop Zone -->
			<div class="pwm-drop-zone" id="pwmDropZone">
				<i class="bx bx-cloud-upload"></i>
				<span>Drop JSON, CSV, HTML, or keys here</span>
			</div>

			<div class="pwm-credential-list" id="pwmCredentialList">
				<!-- Populated dynamically -->
			</div>

			<input type="file" id="pwmFileInput" style="display: none;" multiple />
		`;

		this.searchInput = this.node.querySelector('#pwmSearchInput') as HTMLInputElement;
		this.typeFilterSelect = this.node.querySelector('#pwmTypeFilter') as HTMLSelectElement;
		this.credentialListEl = this.node.querySelector('#pwmCredentialList') as HTMLElement;

		// Bind events
		this.searchInput.addEventListener('input', () => this.filterAndRenderList());
		this.typeFilterSelect.addEventListener('change', () => this.filterAndRenderList());


		const addBtn = this.node.querySelector('#pwmAddBtn');
		addBtn?.addEventListener('click', () => this._createPassword.emit(this.typeFilterSelect.value as CredentialType));

		const exportBtn = this.node.querySelector('#pwmExportBtn');
		exportBtn?.addEventListener('click', () => KeyParser.exportAllCredentials(this.credentials));

		// Drag & Drop Setup
		const dropZone = this.node.querySelector('#pwmDropZone') as HTMLElement;
		dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
		dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
		dropZone.addEventListener('drop', (e) =>
		{
			e.preventDefault();
			dropZone.classList.remove('dragover');
			if(e.dataTransfer?.files)
			{
				KeyParser.handleFileImport(e.dataTransfer.files);
			}
		});
		dropZone.addEventListener('click', () =>
		{
			const fileInput = this.node.querySelector('#pwmFileInput') as HTMLInputElement;
			fileInput.click();
		});

		const fileInput = this.node.querySelector('#pwmFileInput') as HTMLInputElement;
		fileInput.addEventListener('change', (e) =>
		{
			const target = e.target as HTMLInputElement;
			if(target.files) KeyParser.handleFileImport(target.files);
		});

	}

	// --- Filtering & Rendering ---
	private filterAndRenderList(): void
	{
		const query = this.searchInput.value.toLowerCase();
		const typeFilter = this.typeFilterSelect.value;

		this.filteredCredentials = this.credentials.filter(item =>
		{
			const matchesType = typeFilter === 'all' || item.type === typeFilter;
			const matchesQuery = item.title.toLowerCase().includes(query) ||
				item.domain.toLowerCase().includes(query) ||
				item.fields.some(f => f.name.toLowerCase().includes(query) || f.value.toLowerCase().includes(query));
			return matchesType && matchesQuery;
		});

		this.renderListUI();
	}

	private renderListUI(): void
	{
		this.credentialListEl.innerHTML = '';
		if(this.filteredCredentials.length === 0)
		{
			this.credentialListEl.innerHTML = `<div class="pwm-empty-list">No matching credentials found</div>`;
			return;
		}

		this.filteredCredentials.forEach(item =>
		{
			const isSelected = item.id === this.selectedCredentialId;
			const card = document.createElement('div');
			card.className = `pwm-card ${isSelected ? 'selected' : ''}`;
			card.innerHTML = `
				<div class="pwm-card-icon ${item.type}">
					<i class="${this.getTypeIcon(item.type)}"></i>
				</div>
				<div class="pwm-card-info">
					<span class="pwm-card-title">${this.escapeHTML(item.title)}</span>
					<span class="pwm-card-domain">${this.escapeHTML(item.domain)} • ${item.fields.length} fields</span>
				</div>
				<span class="pwm-badge ${item.type}">${item.type}</span>
			`;
			card.addEventListener('click', () =>
			{
				this.selectedCredentialId = item.id;
				this.renderListUI();
				this._selectedPassword.emit(item);
			});
			this.credentialListEl.appendChild(card);
		});
	}

	private escapeHTML(str: string): string
	{
		return str.replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}

	private getTypeIcon(type: string): string
	{
		switch(type)
		{
			case 'login': return 'bx bx-globe';
			case 'apikey': return 'bx bx-code-block';
			case 'securenote': return 'bx bx-note';
			case 'card': return 'bx bx-credit-card';
			case 'ssh': return 'bx bx-terminal';
			default: return 'bx bx-key';
		}
	}

}
