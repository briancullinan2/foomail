import { Widget } from '@lumino/widgets';

// Define interfaces for credential records and autofill fields
export interface CredentialField
{
	id: string;
	type: 'username' | 'email' | 'password' | 'url' | 'phone' | 'totp' | 'text';
	name: string;
	value: string;
}

export interface CredentialRecord
{
	id: string;
	title: string;
	type: 'login' | 'apikey' | 'securenote' | 'card' | 'ssh';
	domain: string;
	fields: CredentialField[];
	updatedAt: number;
}

export class KeystoreWidget extends Widget
{
	private db: IDBDatabase | null = null;
	private credentials: CredentialRecord[] = [];
	private filteredCredentials: CredentialRecord[] = [];
	private selectedCredentialId: string | null = null;

	// UI Elements
	private searchInput!: HTMLInputElement;
	private typeFilterSelect!: HTMLSelectElement;
	private credentialListEl!: HTMLElement;
	private detailContentEl!: HTMLElement;
	private pinOverlayEl!: HTMLElement;
	private pinInput!: HTMLInputElement;

	private isUnlocked: boolean = false;
	private currentPin: string = '1234'; // Default PIN for demo unlock

	constructor(title?: string)
	{
		super();
		this.title.label = title ?? 'Password Manager';
		this.title.iconClass = 'bx bx-key';
		this.addClass('lumino-password-manager');
		this.initDOM();
		this.initIndexedDB();
	}

	private initDOM(): void
	{
		this.node.innerHTML = `
            <div class="pwm-container">
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

                <!-- Sidebar / List View -->
                <div class="pwm-sidebar">
                    <div class="pwm-sidebar-header">
                        <h2><i class="bx bx-key"></i> Passwords</h2>
                        <div class="pwm-actions">
                            <button id="pwmAddBtn" title="Add New Item"><i class="bx bx-plus"></i></button>
                            <button id="pwmExportBtn" title="Export All"><i class="bx bx-arrow-in-down-square-half"></i></button>
                        </div>
                    </div>

                    <div class="pwm-search-bar">
                        <div class="pwm-search-input-wrap">
                            <i class="bx bx-search"></i>
                            <input type="text" id="pwmSearchInput" placeholder="Filter passwords & forms..." />
                        </div>
                        <select id="pwmTypeFilter">
                            <option value="all">All Types</option>
                            <option value="login">Logins</option>
                            <option value="apikey">API Keys</option>
                            <option value="securenote">Notes</option>
                            <option value="card">Cards</option>
                            <option value="ssh">SSH Keys</option>
                        </select>
                    </div>

                    <!-- Drag & Drop Zone -->
                    <div class="pwm-drop-zone" id="pwmDropZone">
                        <i class="bx bx-cloud-upload"></i>
                        <span>Drop JSON, CSV, HTML, or keys here</span>
                    </div>

                    <div class="pwm-credential-list" id="pwmCredentialList">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Main Content / Editor View -->
                <form autocomplete="off" spellcheck="false" data-lpignore="true" class="pwm-main" id="pwmMainContent">
                    <div class="pwm-empty-state">
                        <i class="bx bx-shield-alt-2"></i>
                        <p>Select an item or create a new entry to manage autofill fields.</p>
                    </div>
                </form>
            </div>
            <input type="file" id="pwmFileInput" style="display: none;" multiple />
        `;

		// Cache elements
		this.searchInput = this.node.querySelector('#pwmSearchInput') as HTMLInputElement;
		this.typeFilterSelect = this.node.querySelector('#pwmTypeFilter') as HTMLSelectElement;
		this.credentialListEl = this.node.querySelector('#pwmCredentialList') as HTMLElement;
		this.detailContentEl = this.node.querySelector('#pwmMainContent') as HTMLElement;
		this.pinOverlayEl = this.node.querySelector('#pwmPinOverlay') as HTMLElement;
		this.pinInput = this.node.querySelector('#pwmPinInput') as HTMLInputElement;

		// Bind events
		this.searchInput.addEventListener('input', () => this.filterAndRenderList());
		this.typeFilterSelect.addEventListener('change', () => this.filterAndRenderList());

		const unlockBtn = this.node.querySelector('#pwmUnlockBtn');
		unlockBtn?.addEventListener('click', () => this.handleUnlock());
		this.pinInput.addEventListener('keypress', (e) =>
		{
			if(e.key === 'Enter') this.handleUnlock();
		});

		const addBtn = this.node.querySelector('#pwmAddBtn');
		addBtn?.addEventListener('click', () => this.createNewCredential());

		const exportBtn = this.node.querySelector('#pwmExportBtn');
		exportBtn?.addEventListener('click', () => this.exportAllCredentials());

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
				this.handleFileImport(e.dataTransfer.files);
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
			if(target.files) this.handleFileImport(target.files);
		});
	}

	private handleUnlock(): void
	{
		if(this.pinInput.value === this.currentPin)
		{
			this.isUnlocked = true;
			this.pinOverlayEl.style.display = 'none';
			this.renderDetailView();
		} else
		{
			this.pinInput.classList.add('shake');
			setTimeout(() => this.pinInput.classList.remove('shake'), 400);
			this.pinInput.value = '';
		}
	}

	// --- IndexedDB Management ---
	private initIndexedDB(): void
	{
		const request = indexedDB.open('LuminoPasswordVault', 1);
		request.onerror = () => console.error('IndexedDB error:', request.error);
		request.onsuccess = () =>
		{
			this.db = request.result;
			this.loadCredentials();
		};
		request.onupgradeneeded = (event) =>
		{
			const db = (event.target as IDBOpenDBRequest).result;
			if(!db.objectStoreNames.contains('credentials'))
			{
				db.createObjectStore('credentials', { keyPath: 'id' });
			}
		};
	}

	private loadCredentials(): void
	{
		if(!this.db) return;
		const transaction = this.db.transaction(['credentials'], 'readonly');
		const store = transaction.objectStore('credentials');
		const request = store.getAll();

		request.onsuccess = () =>
		{
			this.credentials = request.result || [];
			if(this.credentials.length === 0)
			{
				// Seed default sample
				this.seedDefaultData();
			} else
			{
				this.filterAndRenderList();
			}
		};
	}

	private saveCredentialToDB(record: CredentialRecord): void
	{
		if(!this.db) return;
		const transaction = this.db.transaction(['credentials'], 'readwrite');
		const store = transaction.objectStore('credentials');
		store.put(record);
		transaction.oncomplete = () => this.loadCredentials();
	}

	private deleteCredentialFromDB(id: string): void
	{
		if(!this.db) return;
		const transaction = this.db.transaction(['credentials'], 'readwrite');
		const store = transaction.objectStore('credentials');
		store.delete(id);
		transaction.oncomplete = () =>
		{
			if(this.selectedCredentialId === id) this.selectedCredentialId = null;
			this.loadCredentials();
		};
	}

	private seedDefaultData(): void
	{
		const sample: CredentialRecord = {
			id: 'rec-1',
			title: 'Google Account',
			type: 'login',
			domain: 'accounts.google.com',
			updatedAt: Date.now(),
			fields: [
				{ id: 'f-1', type: 'email', name: 'identifier', value: 'brian.cullinan@gmail.com' },
				{ id: 'f-2', type: 'password', name: 'password', value: 'SuperSecretPass99!' },
				{ id: 'f-3', type: 'text', name: 'recovery_code', value: 'XYZ-8892-ABC' }
			]
		};
		this.saveCredentialToDB(sample);
	}

	// --- File Ingestion & Parsing ---
	private handleFileImport(files: FileList): void
	{
		Array.from(files).forEach(file =>
		{
			const reader = new FileReader();
			reader.onload = (e) =>
			{
				const content = e.target?.result as string;
				if(!content) return;

				if(file.name.endsWith('.json'))
				{
					try
					{
						const parsed = JSON.parse(content);
						const items = Array.isArray(parsed) ? parsed : [parsed];
						items.forEach((item: any) =>
						{
							const record: CredentialRecord = {
								id: 'imp-' + Math.random().toString(36).substring(2, 9),
								title: item.title || file.name,
								type: item.type || 'login',
								domain: item.domain || 'imported.local',
								updatedAt: Date.now(),
								fields: item.fields || []
							};
							this.saveCredentialToDB(record);
						});
					} catch(err) { console.error('Invalid JSON format'); }
				} else if(file.name.endsWith('.csv'))
				{
					const lines = content.split('\n');
					lines.forEach((line, idx) =>
					{
						if(idx === 0 || !line.trim()) return; // skip header
						const parts = line.split(',');
						if(parts.length >= 2)
						{
							const record: CredentialRecord = {
								id: 'csv-' + Math.random().toString(36).substring(2, 9),
								title: parts[0]?.trim() || `CSV Import ${idx}`,
								type: 'login',
								domain: parts[1]?.trim() || 'csv.local',
								updatedAt: Date.now(),
								fields: [
									{ id: 'f-1', type: 'username', name: 'username', value: parts[2]?.trim() || '' },
									{ id: 'f-2', type: 'password', name: 'password', value: parts[3]?.trim() || '' }
								]
							};
							this.saveCredentialToDB(record);
						}
					});
				} else
				{
					// Generic HTML / API Key Text scan
					const isApiKey = content.includes('AIza') || content.includes('key-') || content.length < 200;
					const record: CredentialRecord = {
						id: 'scan-' + Math.random().toString(36).substring(2, 9),
						title: file.name,
						type: isApiKey ? 'apikey' : 'securenote',
						domain: 'scanned-file',
						updatedAt: Date.now(),
						fields: [
							{ id: 'f-1', type: isApiKey ? 'password' : 'text', name: isApiKey ? 'api_key' : 'content_dump', value: content.trim() }
						]
					};
					this.saveCredentialToDB(record);
				}
			};
			reader.readAsText(file);
		});
	}

	private exportAllCredentials(): void
	{
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.credentials, null, 2));
		const downloadAnchor = document.createElement('a');
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `lumino_passwords_${Date.now()}.json`);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
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
				this.renderDetailView();
			});
			this.credentialListEl.appendChild(card);
		});
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

	private createNewCredential(): void
	{
		const newRec: CredentialRecord = {
			id: 'rec-' + Math.random().toString(36).substring(2, 9),
			title: 'New Service Login',
			type: 'login',
			domain: 'example.com',
			updatedAt: Date.now(),
			fields: [
				{ id: 'f-' + Math.random(), type: 'username', name: 'username', value: '' },
				{ id: 'f-' + Math.random(), type: 'password', name: 'password', value: '' }
			]
		};
		this.saveCredentialToDB(newRec);
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
		saveBtn?.addEventListener('click', () =>
		{
			record.title = (this.detailContentEl.querySelector('#pwmEditTitle') as HTMLInputElement).value;
			record.domain = (this.detailContentEl.querySelector('#pwmEditDomain') as HTMLInputElement).value;
			record.type = (this.detailContentEl.querySelector('#pwmEditType') as HTMLSelectElement).value as any;
			record.updatedAt = Date.now();
			this.saveCredentialToDB(record);
		});

		const deleteBtn = this.detailContentEl.querySelector('#pwmDeleteBtn');
		deleteBtn?.addEventListener('click', () =>
		{
			if(confirm(`Delete "${record.title}"?`))
			{
				this.deleteCredentialFromDB(record.id);
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
