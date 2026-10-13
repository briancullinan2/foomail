import { Widget } from '@lumino/widgets';
import { PasswordsSidebar } from './widget-sidebar';
import { Message } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import { KeyParser } from './key-parser';

// Define interfaces for credential records and autofill fields
export interface CredentialField
{
	id: string;
	type: 'username' | 'email' | 'password' | 'url' | 'phone' | 'totp' | 'text';
	name: string;
	value: string;
}

export type CredentialType = 'login' | 'apikey' | 'securenote' | 'card' | 'ssh';

export interface CredentialRecord
{
	id: string;
	title: string;
	type: CredentialType;
	domain: string;
	path: string;
	parent: string;
	fields: CredentialField[];
	updatedAt: number;
	isDeleted?: boolean;
}


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & RepositorySettingsWindow & LuminoLayoutWindow = self as unknown as any;


export class KeystoreWidget extends Widget
{
	private credentials: CredentialRecord[] = [];
	private selectedCredentialId: string | null = null;
	private filteredCredentials: CredentialRecord[] = [];

	// UI Elements
	private detailContentEl!: HTMLElement;
	private pinOverlayEl!: HTMLElement;
	private pinInput!: HTMLInputElement;

	private isUnlocked: boolean = false;
	private currentPin: string = '1234'; // Default PIN for demo unlock
	private _keystoreSidebar?: PasswordsSidebar;
	private _passwordsChanged: Signal<KeystoreWidget, CredentialRecord[]> = new Signal(this);
	private isEditing: boolean = false;

	private subSelected: (_: Widget, item: CredentialRecord) => any = (_, item) =>
	{
		this.selectedCredentialId = item.id;
		this.renderDetailView();
	};

	private subCreated: (_: Widget, type: CredentialType) => any = (_, type) =>
	{
		this.createNewCredential(type);
		this.renderDetailView();
	};

	private subEditing: (_: Widget, id: boolean) => any = (_, edit) =>
	{
		this.isEditing = edit;
		this.renderDetailView();
	};

	private subChanged: (_: Widget, items: CredentialRecord[]) => any = (_, items) =>
	{
		this.credentials = items;
		this.renderDetailView();
	};

	public get passwordsChanged(): ISignal<KeystoreWidget, CredentialRecord[]>
	{
		return this._passwordsChanged;
	}

	constructor(title?: string)
	{
		super();
		this.title.label = title ?? 'Password Manager';
		this.title.iconClass = 'bx bx-key';
		this.title.closable = true;
		this.addClass('lumino-password-manager');
		this.initDOM();
		// KeyParser.initIndexedDB().then(() => this.loadCredentials());
	}

	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this.openSidebar();
		this.resubscribeSidebar();
	}

	private resubscribeSidebar()
	{
		this._keystoreSidebar?.selectedPassword.disconnect(this.subSelected);
		this._keystoreSidebar?.createPassword.disconnect(this.subCreated);
		// this._keystoreSidebar?.editEmail.disconnect(this.subEditing);
		this._keystoreSidebar?.passwordsChanged.disconnect(this.subChanged);
		this._keystoreSidebar?.selectedPassword.connect(this.subSelected);
		this._keystoreSidebar?.createPassword.connect(this.subCreated);
		// this._keystoreSidebar?.editEmail.connect(this.subEditing);
		this._keystoreSidebar?.passwordsChanged.connect(this.subChanged);
	}


	protected override onBeforeHide(msg: Message): void
	{
		this._keystoreSidebar?.selectedPassword.disconnect(this.subSelected);
		this._keystoreSidebar?.createPassword.disconnect(this.subCreated);
		// this._keystoreSidebar?.editEmail.disconnect(this.subEditing);
		this._keystoreSidebar?.passwordsChanged.disconnect(this.subChanged);
		this._keystoreSidebar?.close();
		super.onBeforeHide(msg);
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._keystoreSidebar?.selectedPassword.disconnect(this.subSelected);
		this._keystoreSidebar?.createPassword.disconnect(this.subCreated);
		// this._keystoreSidebar?.editEmail.disconnect(this.subEditing);
		this._keystoreSidebar?.passwordsChanged.disconnect(this.subChanged);
		this._keystoreSidebar?.close();
		super.onBeforeDetach(msg);
	}

	private openSidebar()
	{
		if(!this.isUnlocked)
		{
			return;
		}
		const that = this;
		setTimeout(() =>
		{
			if(widgetSelf.mainDock && widgetSelf.LayoutAdjuster && that._keystoreSidebar)
			{
				if(!this._keystoreSidebar?.isAttached)
				{
					widgetSelf.LayoutAdjuster?.addOptimalWidgetLayout(widgetSelf.mainDock, that._keystoreSidebar, {
						type: 'outline',
						projectId: that._keystoreSidebar?.constructor.name
					});
				}
			}
		}, 300);
	}


	protected onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		if(this._keystoreSidebar && !this._keystoreSidebar.isAttached)
		{
			this.openSidebar();
		}
		this.resubscribeSidebar();
	}

	private initDOM(): void
	{
		this.node.innerHTML = `
			<!-- PIN Overlay -->
			<div class="pwm-pin-overlay" id="pwmPinOverlay">
				<div class="pwm-pin-box">
					<i class="bx bx-shield-quarter pwm-pin-icon"></i>
					<h2>Vault Locked</h2>
					<p>Enter your 4-digit PIN to reveal credentials (default: 1234)</p>
					<input type="password" id="pwmPinInput" maxlength="4" placeholder="••••" />
					<button id="pwmUnlockBtn" class="pwm-btn primary">Unlock Vault</button>
				</div>
			</div>

			<!-- Main Content / Editor View -->
			<form autocomplete="off" spellcheck="false" data-lpignore="true" class="pwm-main" id="pwmMainContent">
				<div class="pwm-empty-state">
					<i class="bx bx-shield-alt-2"></i>
					<p>Select an item or create a new entry to manage autofill fields.</p>
				</div>
			</form>
        `;

		// Cache elements
		this.detailContentEl = this.node.querySelector('#pwmMainContent') as HTMLElement;
		this.pinOverlayEl = this.node.querySelector('#pwmPinOverlay') as HTMLElement;
		this.pinInput = this.node.querySelector('#pwmPinInput') as HTMLInputElement;

		const unlockBtn = this.node.querySelector('#pwmUnlockBtn');
		unlockBtn?.addEventListener('click', () => this.handleUnlock());
		this.pinInput.addEventListener('keypress', (e) =>
		{
			if(e.key === 'Enter') this.handleUnlock();
		});
		this.pinInput.addEventListener('keyup', (e) =>
		{
			if(this.pinInput.value === this.currentPin) this.handleUnlock();
			if(this.pinInput.value.length === 4) this.handleUnlock();
		});
		this._keystoreSidebar = new PasswordsSidebar(undefined, {
			passwordsChanged: this.passwordsChanged
		});

	}

	private handleUnlock(): void
	{
		if(this.pinInput.value === this.currentPin)
		{
			this.isUnlocked = true;
			this.pinOverlayEl.style.display = 'none';
			this.loadCredentials();
			this.openSidebar();
			this.renderDetailView();
		} else
		{
			this.pinInput.classList.add('shake');
			setTimeout(() => this.pinInput.classList.remove('shake'), 400);
			this.pinInput.value = '';
		}
	}

	private async loadCredentials(): Promise<void>
	{
		KeyParser.db ??= await KeyParser.initIndexedDB();
		return await new Promise((resolve, reject) =>
		{
			if(!KeyParser.db) return reject(new Error('No db'));
			const transaction = KeyParser.db.transaction(['credentials'], 'readonly');
			const store = transaction.objectStore('credentials');
			const request = store.getAll();

			request.onsuccess = () =>
			{
				this.credentials = request.result || [];
				if(this.credentials.length === 0)
				{
					this.seedDefaultData();
				}
				this._passwordsChanged.emit(this.credentials);
				resolve();
			};
			transaction.onerror = (e) => reject(e);
		});
	}

	private async seedDefaultData(): Promise<void>
	{
		const sample: CredentialRecord = {
			id: 'rec-1',
			title: 'Google Account',
			type: 'login',
			path: 'demo-data',
			parent: '',
			domain: 'accounts.google.com',
			updatedAt: Date.now(),
			fields: [
				{ id: 'f-1', type: 'email', name: 'identifier', value: 'brian.cullinan@gmail.com' },
				{ id: 'f-2', type: 'password', name: 'password', value: 'SuperSecretPass99!' },
				{ id: 'f-3', type: 'text', name: 'recovery_code', value: 'XYZ-8892-ABC' }
			]
		};
		await KeyParser.saveCredentialToDB(sample);
		await this.loadCredentials();

	}



	// --- Filtering & Rendering ---
	// private filterAndRenderList(): void
	// {
	// 	const query = this.searchInput.value.toLowerCase();
	// 	const typeFilter = this.typeFilterSelect.value;

	// 	this.filteredCredentials = this.credentials.filter(item =>
	// 	{
	// 		const matchesType = typeFilter === 'all' || item.type === typeFilter;
	// 		const matchesQuery = item.title.toLowerCase().includes(query) ||
	// 			item.domain.toLowerCase().includes(query) ||
	// 			item.fields.some(f => f.name.toLowerCase().includes(query) || f.value.toLowerCase().includes(query));
	// 		return matchesType && matchesQuery;
	// 	});

	// 	this._passwordsChanged.emit(this.filteredCredentials)
	// }

	private getFieldTypeIcon(fieldType: string): string
	{
		switch(fieldType)
		{
			case 'username': return 'bx bx-user';
			case 'email': return 'bx bx-envelope';
			case 'password': return 'bx bx-lock';
			case 'url': return 'bx bx-link';
			case 'phone': return 'bx bx-phone';
			case 'totp': return 'bx bx-time-five';
			default: return 'bx bx-lowercase';
		}
	}

	private createNewCredential(type?: CredentialType): void
	{
		const newRec: CredentialRecord = {
			id: 'rec-' + Math.random().toString(36).substring(2, 9),
			title: 'New Service Login',
			type: type ?? 'login',
			path: 'password-creator',
			parent: '',
			domain: 'example.com',
			updatedAt: Date.now(),
			fields: [
				{ id: 'f-' + Math.random(), type: 'username', name: 'username', value: '' },
				{ id: 'f-' + Math.random(), type: 'password', name: 'password', value: '' }
			]
		};

		this.selectedCredentialId = newRec.id;
	}

	private renderDetailView(): void
	{
		if(!this.isUnlocked) return;

		const record = this.credentials.find(c => c.id === this.selectedCredentialId);
		if(!record)
		{
			this.detailContentEl.innerHTML = `
                <div class="pwm-empty-state">
                    <i class="bx bx-shield-alt-2"></i>
                    <p>Select an item or create a new entry to manage autofill fields.</p>
                </div>`;
			return;
		}

		this.detailContentEl.innerHTML = `
            <div class="pwm-detail-header">
                <div class="pwm-detail-title-group">
                    <input type="text" id="pwmEditTitle" value="${this.escapeHTML(record.title)}" placeholder="Service Title" />
                    <input type="text" id="pwmEditDomain" value="${this.escapeHTML(record.domain)}" placeholder="Domain / URI" />
                </div>
                <div class="pwm-detail-actions">
                    <select id="pwmEditType">
                        <option value="login" ${record.type === 'login' ? 'selected' : ''}>Login</option>
                        <option value="apikey" ${record.type === 'apikey' ? 'selected' : ''}>API Key</option>
                        <option value="securenote" ${record.type === 'securenote' ? 'selected' : ''}>Secure Note</option>
                        <option value="card" ${record.type === 'card' ? 'selected' : ''}>Card</option>
                        <option value="ssh" ${record.type === 'ssh' ? 'selected' : ''}>SSH Key</option>
                    </select>
                    <button id="pwmRevealAllBtn" class="pwm-btn secondary" title="Reveal All Fields"><i class="bx bx-show"></i> Toggle Reveal</button>
                    <button id="pwmDeleteBtn" class="pwm-btn danger" title="Delete Entry"><i class="bx bx-trash"></i></button>
                </div>
            </div>

            <div class="pwm-fields-section">
                <div class="pwm-fields-header">
                    <h3>Autofill Form Mapping Fields</h3>
                    <button id="pwmAddFieldBtn" class="pwm-btn primary sm"><i class="bx bx-plus"></i> Add Field</button>
                </div>
                <div class="pwm-fields-list" id="pwmFieldsList">
                    <!-- Fields injected here -->
                </div>
            </div>

            <div class="pwm-footer-actions">
                <button id="pwmSaveBtn" class="pwm-btn primary lg"><i class="bx bx-save"></i> Save Changes</button>
            </div>
        `;

		const fieldsListEl = this.detailContentEl.querySelector('#pwmFieldsList') as HTMLElement;
		this.renderFieldsList(record, fieldsListEl);

		// Bind Detail Events
		const saveBtn = this.detailContentEl.querySelector('#pwmSaveBtn');
		saveBtn?.addEventListener('click', async () =>
		{
			record.title = (this.detailContentEl.querySelector('#pwmEditTitle') as HTMLInputElement).value;
			record.domain = (this.detailContentEl.querySelector('#pwmEditDomain') as HTMLInputElement).value;
			record.type = (this.detailContentEl.querySelector('#pwmEditType') as HTMLSelectElement).value as any;
			record.updatedAt = Date.now();
			await KeyParser.saveCredentialToDB(record);
			await this.loadCredentials();
		});

		const deleteBtn = this.detailContentEl.querySelector('#pwmDeleteBtn');
		deleteBtn?.addEventListener('click', async () =>
		{
			if(confirm(`Delete "${record.title}"?`))
			{
				await KeyParser.deleteCredentialFromDB(record.id);
				if(this.selectedCredentialId === record.id) this.selectedCredentialId = null;
				await this.loadCredentials();
			}
		});

		const addFieldBtn = this.detailContentEl.querySelector('#pwmAddFieldBtn');
		addFieldBtn?.addEventListener('click', () =>
		{
			record.fields.push({
				id: 'f-' + Math.random().toString(36).substring(2, 9),
				type: 'text',
				name: 'custom_field',
				value: ''
			});
			this.renderFieldsList(record, fieldsListEl);
		});

		const revealAllBtn = this.detailContentEl.querySelector('#pwmRevealAllBtn');
		let isRevealed = false;
		revealAllBtn?.addEventListener('click', () =>
		{
			isRevealed = !isRevealed;
			const inputs = fieldsListEl.querySelectorAll('.pwm-field-value') as NodeListOf<HTMLInputElement>;
			inputs.forEach(input =>
			{
				input.type = isRevealed ? 'text' : 'password';
			});
			revealAllBtn.innerHTML = isRevealed ? `<i class="bx bx-hide"></i> Hide All` : `<i class="bx bx-show"></i> Toggle Reveal`;
		});
	}

	private renderFieldsList(record: CredentialRecord, container: HTMLElement): void
	{
		container.innerHTML = '';
		if(record.fields.length === 0)
		{
			container.innerHTML = `<div class="pwm-empty-fields">No form fields mapped. Add fields to enable smart autofill.</div>`;
			return;
		}

		record.fields.forEach((field, index) =>
		{
			const row = document.createElement('div');
			row.className = 'pwm-field-row';
			row.innerHTML = `
                <div class="pwm-field-type-icon" title="Field Type: ${field.type}">
                    <i class="${this.getFieldTypeIcon(field.type)}"></i>
                </div>
                <select class="pwm-field-type-select" data-index="${index}">
                    <option value="username" ${field.type === 'username' ? 'selected' : ''}>Username</option>
                    <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
                    <option value="password" ${field.type === 'password' ? 'selected' : ''}>Password</option>
                    <option value="url" ${field.type === 'url' ? 'selected' : ''}>URL</option>
                    <option value="phone" ${field.type === 'phone' ? 'selected' : ''}>Phone</option>
                    <option value="totp" ${field.type === 'totp' ? 'selected' : ''}>TOTP</option>
                    <option value="text" ${field.type === 'text' ? 'selected' : ''}>Text</option>
                </select>
                <input type="text" class="pwm-field-name" data-index="${index}" value="${this.escapeHTML(field.name)}" placeholder="Field name / selector" />
                <input type="password" class="pwm-field-value" data-index="${index}" value="${this.escapeHTML(field.value)}" placeholder="Field value" readonly />
                <button class="pwm-btn icon-only delete-field" data-index="${index}" title="Remove Field"><i class="bx bx-x"></i></button>
            `;

			// Make inputs editable on click/focus or read-only encoded by default
			const valInput = row.querySelector('.pwm-field-value') as HTMLInputElement;
			valInput.addEventListener('focus', () => { valInput.removeAttribute('readonly'); });
			valInput.addEventListener('blur', () => { valInput.setAttribute('readonly', 'true'); });
			valInput.addEventListener('input', () => { field.value = valInput.value; });

			const nameInput = row.querySelector('.pwm-field-name') as HTMLInputElement;
			nameInput.addEventListener('input', () => { field.name = nameInput.value; });

			const typeSelect = row.querySelector('.pwm-field-type-select') as HTMLSelectElement;
			typeSelect.addEventListener('change', () =>
			{
				field.type = typeSelect.value as any;
				const iconContainer = row.querySelector('.pwm-field-type-icon i') as HTMLElement;
				iconContainer.className = this.getFieldTypeIcon(field.type);
			});

			const deleteFieldBtn = row.querySelector('.delete-field');
			deleteFieldBtn?.addEventListener('click', () =>
			{
				record.fields.splice(index, 1);
				this.renderFieldsList(record, container);
			});

			container.appendChild(row);
		});
	}

	private escapeHTML(str: string): string
	{
		return str.replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
