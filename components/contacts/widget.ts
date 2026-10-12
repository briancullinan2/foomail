import { Widget } from '@lumino/widgets';

export interface VCardContact
{
	uid: string;
	categories: string; // Organizational group (e.g., Work, Friends, Engineering)
	fn: string;          // Formatted Name
	n: string;           // Structured Name (Last;First;Middle;Prefix;Suffix)
	nickname: string;
	email: string;
	tel: string;
	adr: string;         // Street;Extended;City;State;Zip;Country
	title: string;
	org: string;
	role: string;
	bday: string;
	url: string;
	note: string;
	tz: string;
	geo: string;
	rev: string;
}

export class ContactsWidget extends Widget
{
	private contacts: VCardContact[] = [];
	private filteredContacts: VCardContact[] = [];
	private selectedContactUid: string | null = null;
	private selectedGroup: string = 'All';
	private isEditing: boolean = false;

	// UI Elements
	private groupListEl!: HTMLElement;
	private contactListEl!: HTMLElement;
	private detailPaneEl!: HTMLElement;
	private searchInput!: HTMLInputElement;

	constructor(title?: string)
	{
		super();
		this.title.label = title ?? 'Contacts List';
		this.title.iconClass = 'bx bx-group';
		this.addClass('lumino-contact-manager');
		this.initDOM();
		this.loadSampleContacts();
	}

	private initDOM(): void
	{
		this.node.innerHTML = `
            <div class="cm-layout">
                <!-- Left Sidebar: Organizational Groups -->
                <div class="cm-sidebar">
                    <div class="cm-sidebar-header">
                        <h2><i class="bx bx-group"></i> Groups</h2>
                        <button id="cmAddContactBtn" class="cm-btn primary" title="Add Contact"><i class="bx bx-plus"></i></button>
                    </div>
                    <div class="cm-group-list" id="cmGroupList">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Middle Pane: Contact List -->
                <div class="cm-list-pane">
                    <div class="cm-search-bar">
                        <i class="bx bx-search"></i>
                        <input type="text" id="cmSearchInput" placeholder="Search contacts or details..." />
                    </div>
                    <div class="cm-contact-items" id="cmContactItems">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Right/Center Pane: Contact View & Comprehensive Edit Form -->
                <div class="cm-detail-pane" id="cmDetailPane">
                    <div class="cm-empty-state">
                        <i class="bx bx-user-pin"></i>
                        <p>Select a contact to view or edit full vCard attributes.</p>
                    </div>
                </div>
            </div>
        `;

		// Cache DOM elements
		this.groupListEl = this.node.querySelector('#cmGroupList') as HTMLElement;
		this.contactListEl = this.node.querySelector('#cmContactItems') as HTMLElement;
		this.detailPaneEl = this.node.querySelector('#cmDetailPane') as HTMLElement;
		this.searchInput = this.node.querySelector('#cmSearchInput') as HTMLInputElement;

		// Bind events
		this.searchInput.addEventListener('input', () => this.filterAndRender());

		const addBtn = this.node.querySelector('#cmAddContactBtn');
		addBtn?.addEventListener('click', () => this.createNewContact());
	}

	private loadSampleContacts(): void
	{
		this.contacts = [
			{
				uid: 'c-1',
				categories: 'Engineering',
				fn: 'Brian James Cullinan',
				n: 'Cullinan;Brian;James;;',
				nickname: 'BC',
				email: 'brian.cullinan@gmail.com',
				tel: '+1-555-0199',
				adr: ';;123 Silicon Way;Scottsdale;AZ;85251;USA',
				title: 'Software Developer',
				org: 'Pryor Games',
				role: 'Architect',
				bday: '1990-01-01',
				url: 'https://pryor.games',
				note: 'Specializing in TypeScript, Node.js, and web application architecture.',
				tz: '-07:00',
				geo: '33.4942;-111.9261',
				rev: new Date().toISOString()
			}
		];
		this.renderGroups();
		this.filterAndRender();
	}

	// --- DropFiles implementation for VCF parsing ---
	public async dropFiles(files: FileList): Promise<void>
	{
		for(let i = 0; i < files.length; i++)
		{
			const file = files[i];
			const text = await file.text();
			this.parseVCardString(text);
		}
		this.renderGroups();
		this.filterAndRender();
	}

	private parseVCardString(vcardData: string): void
	{
		const cards = vcardData.split('BEGIN:VCARD');
		cards.forEach(cardText =>
		{
			if(!cardText.includes('END:VCARD')) return;

			const getField = (tag: string): string =>
			{
				const regex = new RegExp(`^${tag}(?:;[^:]*)?:(.*)$`, 'm');
				const match = cardText.match(regex);
				return match ? match[1].trim() : '';
			};

			const newContact: VCardContact = {
				uid: 'imp-' + Math.random().toString(36).substring(2, 9),
				categories: getField('CATEGORIES') || 'Imported',
				fn: getField('FN') || 'Unnamed Contact',
				n: getField('N'),
				nickname: getField('NICKNAME'),
				email: getField('EMAIL'),
				tel: getField('TEL'),
				adr: getField('ADR'),
				title: getField('TITLE'),
				org: getField('ORG'),
				role: getField('ROLE'),
				bday: getField('BDAY'),
				url: getField('URL'),
				note: getField('NOTE'),
				tz: getField('TZ'),
				geo: getField('GEO'),
				rev: new Date().toISOString()
			};

			this.contacts.push(newContact);
		});
	}

	private renderGroups(): void
	{
		const groupsMap = new Map<string, number>();
		groupsMap.set('All', this.contacts.length);

		this.contacts.forEach(c =>
		{
			const cat = c.categories || 'Uncategorized';
			groupsMap.set(cat, (groupsMap.get(cat) || 0) + 1);
		});

		this.groupListEl.innerHTML = '';
		groupsMap.forEach((count, groupName) =>
		{
			const item = document.createElement('div');
			item.className = `cm-group-item ${this.selectedGroup === groupName ? 'active' : ''}`;
			item.innerHTML = `
                <span><i class="bx bx-folder"></i> ${this.escapeHTML(groupName)}</span>
                <span class="cm-count">${count}</span>
            `;
			item.addEventListener('click', () =>
			{
				this.selectedGroup = groupName;
				this.renderGroups();
				this.filterAndRender();
			});
			this.groupListEl.appendChild(item);
		});
	}

	private filterAndRender(): void
	{
		const query = this.searchInput.value.toLowerCase();

		this.filteredContacts = this.contacts.filter(c =>
		{
			const matchesGroup = this.selectedGroup === 'All' || c.categories === this.selectedGroup;
			const matchesQuery = c.fn.toLowerCase().includes(query) ||
				c.email.toLowerCase().includes(query) ||
				c.org.toLowerCase().includes(query) ||
				c.tel.toLowerCase().includes(query);
			return matchesGroup && matchesQuery;
		});

		this.renderContactList();
	}

	private renderContactList(): void
	{
		this.contactListEl.innerHTML = '';
		if(this.filteredContacts.length === 0)
		{
			this.contactListEl.innerHTML = `<div class="cm-empty-list">No contacts found</div>`;
			return;
		}

		this.filteredContacts.forEach(c =>
		{
			const isSelected = c.uid === this.selectedContactUid;
			const card = document.createElement('div');
			card.className = `cm-contact-card ${isSelected ? 'selected' : ''}`;
			card.innerHTML = `
                <div class="cm-avatar">${c.fn.charAt(0).toUpperCase()}</div>
                <div class="cm-contact-preview">
                    <span class="cm-name">${this.escapeHTML(c.fn)}</span>
                    <span class="cm-org">${this.escapeHTML(c.org || c.title || 'No Organization')}</span>
                </div>
            `;
			card.addEventListener('click', () =>
			{
				this.selectedContactUid = c.uid;
				this.isEditing = false;
				this.renderContactList();
				this.renderDetailPane();
			});
			this.contactListEl.appendChild(card);
		});
	}

	private createNewContact(): void
	{
		const newC: VCardContact = {
			uid: 'c-' + Math.random().toString(36).substr(2, 9),
			categories: this.selectedGroup === 'All' ? 'General' : this.selectedGroup,
			fn: 'New Contact',
			n: ';New;;;',
			nickname: '',
			email: '',
			tel: '',
			adr: ';;;;;;',
			title: '',
			org: '',
			role: '',
			bday: '',
			url: '',
			note: '',
			tz: '',
			geo: '',
			rev: new Date().toISOString()
		};
		this.contacts.push(newC);
		this.selectedContactUid = newC.uid;
		this.isEditing = true;
		this.renderGroups();
		this.filterAndRender();
		this.renderDetailPane();
	}

	private renderDetailPane(): void
	{
		const contact = this.contacts.find(c => c.uid === this.selectedContactUid);
		if(!contact)
		{
			this.detailPaneEl.innerHTML = `
                <div class="cm-empty-state">
                    <i class="bx bx-user-pin"></i>
                    <p>Select a contact to view or edit full vCard attributes.</p>
                </div>`;
			return;
		}

		if(this.isEditing)
		{
			this.renderEditForm(contact);
		} else
		{
			this.renderReadOnlyView(contact);
		}
	}

	private renderReadOnlyView(c: VCardContact): void
	{
		this.detailPaneEl.innerHTML = `
            <div class="cm-detail-header">
                <div class="cm-detail-title-group">
                    <div class="cm-large-avatar">${c.fn.charAt(0).toUpperCase()}</div>
                    <div>
                        <h2>${this.escapeHTML(c.fn)}</h2>
                        <span class="cm-subtitle">${this.escapeHTML(c.title)} ${c.org ? 'at ' + this.escapeHTML(c.org) : ''}</span>
                    </div>
                </div>
                <div class="cm-detail-actions">
                    <button id="cmEditBtn" class="cm-btn primary"><i class="bx bx-edit"></i> Edit</button>
                    <button id="cmExportVcfBtn" class="cm-btn secondary"><i class="bx bx-download"></i> Export .vcf</button>
                    <button id="cmDeleteBtn" class="cm-btn danger"><i class="bx bx-trash"></i></button>
                </div>
            </div>

            <div class="cm-attributes-grid">
                <div class="cm-attr-group"><h3>Identifiers & Names</h3>
                    <div><label>Formatted Name (FN):</label> <span>${this.escapeHTML(c.fn)}</span></div>
                    <div><label>Structured Name (N):</label> <span>${this.escapeHTML(c.n)}</span></div>
                    <div><label>Nickname:</label> <span>${this.escapeHTML(c.nickname)}</span></div>
                    <div><label>UID:</label> <span>${this.escapeHTML(c.uid)}</span></div>
                </div>
                <div class="cm-attr-group"><h3>Communication</h3>
                    <div><label>Email:</label> <span>${this.escapeHTML(c.email)}</span></div>
                    <div><label>Telephone:</label> <span>${this.escapeHTML(c.tel)}</span></div>
                    <div><label>Website (URL):</label> <span><a href="${c.url}" target="_blank">${this.escapeHTML(c.url)}</a></span></div>
                </div>
                <div class="cm-attr-group"><h3>Work & Organization</h3>
                    <div><label>Organization (ORG):</label> <span>${this.escapeHTML(c.org)}</span></div>
                    <div><label>Job Title (TITLE):</label> <span>${this.escapeHTML(c.title)}</span></div>
                    <div><label>Role:</label> <span>${this.escapeHTML(c.role)}</span></div>
                    <div><label>Category Group:</label> <span class="cm-tag">${this.escapeHTML(c.categories)}</span></div>
                </div>
                <div class="cm-attr-group"><h3>Address & Location</h3>
                    <div><label>Address (ADR):</label> <span>${this.escapeHTML(c.adr)}</span></div>
                    <div><label>Timezone (TZ):</label> <span>${this.escapeHTML(c.tz)}</span></div>
                    <div><label>Geo Coordinates:</label> <span>${this.escapeHTML(c.geo)}</span></div>
                </div>
                <div class="cm-attr-group full-width"><h3>Additional Details</h3>
                    <div><label>Birthday (BDAY):</label> <span>${this.escapeHTML(c.bday)}</span></div>
                    <div><label>Notes (NOTE):</label> <p>${this.escapeHTML(c.note)}</p></div>
                    <div><label>Last Revision:</label> <span>${this.escapeHTML(c.rev)}</span></div>
                </div>
            </div>
        `;

		this.detailPaneEl.querySelector('#cmEditBtn')?.addEventListener('click', () =>
		{
			this.isEditing = true;
			this.renderDetailPane();
		});

		this.detailPaneEl.querySelector('#cmExportVcfBtn')?.addEventListener('click', () =>
		{
			this.exportSingleVCard(c);
		});

		this.detailPaneEl.querySelector('#cmDeleteBtn')?.addEventListener('click', () =>
		{
			if(confirm(`Delete contact "${c.fn}"?`))
			{
				this.contacts = this.contacts.filter(item => item.uid !== c.uid);
				this.selectedContactUid = null;
				this.renderGroups();
				this.filterAndRender();
				this.detailPaneEl.innerHTML = `<div class="cm-empty-state"><i class="bx bx-user-pin"></i><p>Select a contact...</p></div>`;
			}
		});
	}

	private renderEditForm(c: VCardContact): void
	{
		this.detailPaneEl.innerHTML = `
            <div class="cm-detail-header">
                <h2>Editing vCard Properties</h2>
                <div class="cm-detail-actions">
                    <button id="cmSaveBtn" class="cm-btn primary"><i class="bx bx-save"></i> Save Changes</button>
                    <button id="cmCancelBtn" class="cm-btn secondary">Cancel</button>
                </div>
            </div>

            <div class="cm-form-grid" id="cmEditFormFields">
                <div class="cm-field"><label>Formatted Name (FN)*</label><input type="text" name="fn" value="${this.escapeHTML(c.fn)}" /></div>
                <div class="cm-field"><label>Structured Name (N: Last;First;Middle;Prefix;Suffix)</label><input type="text" name="n" value="${this.escapeHTML(c.n)}" /></div>
                <div class="cm-field"><label>Nickname</label><input type="text" name="nickname" value="${this.escapeHTML(c.nickname)}" /></div>
                <div class="cm-field"><label>Category Group</label><input type="text" name="categories" value="${this.escapeHTML(c.categories)}" /></div>

                <div class="cm-field"><label>Email Address</label><input type="text" name="email" value="${this.escapeHTML(c.email)}" /></div>
                <div class="cm-field"><label>Telephone (TEL)</label><input type="text" name="tel" value="${this.escapeHTML(c.tel)}" /></div>
                <div class="cm-field"><label>Website (URL)</label><input type="text" name="url" value="${this.escapeHTML(c.url)}" /></div>
                <div class="cm-field"><label>Birthday (BDAY)</label><input type="date" name="bday" value="${this.escapeHTML(c.bday)}" /></div>

                <div class="cm-field"><label>Organization (ORG)</label><input type="text" name="org" value="${this.escapeHTML(c.org)}" /></div>
                <div class="cm-field"><label>Job Title (TITLE)</label><input type="text" name="title" value="${this.escapeHTML(c.title)}" /></div>
                <div class="cm-field"><label>Role</label><input type="text" name="role" value="${this.escapeHTML(c.role)}" /></div>
                <div class="cm-field"><label>Timezone (TZ)</label><input type="text" name="tz" value="${this.escapeHTML(c.tz)}" /></div>

                <div class="cm-field full-width"><label>Address (ADR: ;;Street;City;State;Zip;Country)</label><input type="text" name="adr" value="${this.escapeHTML(c.adr)}" /></div>
                <div class="cm-field"><label>Geo Coordinates</label><input type="text" name="geo" value="${this.escapeHTML(c.geo)}" /></div>
                <div class="cm-field"><label>UID</label><input type="text" name="uid" value="${this.escapeHTML(c.uid)}" readonly /></div>

                <div class="cm-field full-width"><label>Notes (NOTE)</label><textarea name="note">${this.escapeHTML(c.note)}</textarea></div>
            </div>
        `;

		this.detailPaneEl.querySelector('#cmSaveBtn')?.addEventListener('click', () =>
		{
			const formContainer = this.detailPaneEl.querySelector('#cmEditFormFields') as HTMLElement;
			const inputs = formContainer.querySelectorAll('input, textarea') as NodeListOf<HTMLInputElement>;

			inputs.forEach(input =>
			{
				const fieldName = input.name as keyof VCardContact;
				if(fieldName && fieldName in c)
				{
					(c as any)[fieldName] = input.value;
				}
			});

			c.rev = new Date().toISOString();
			this.isEditing = false;
			this.renderGroups();
			this.filterAndRender();
			this.renderDetailPane();
		});

		this.detailPaneEl.querySelector('#cmCancelBtn')?.addEventListener('click', () =>
		{
			this.isEditing = false;
			this.renderDetailPane();
		});
	}

	private exportSingleVCard(c: VCardContact): void
	{
		const vcfContent = [
			'BEGIN:VCARD',
			'VERSION:3.0',
			`FN:${c.fn}`,
			`N:${c.n}`,
			c.nickname ? `NICKNAME:${c.nickname}` : '',
			c.email ? `EMAIL:${c.email}` : '',
			c.tel ? `TEL:${c.tel}` : '',
			c.adr ? `ADR:${c.adr}` : '',
			c.org ? `ORG:${c.org}` : '',
			c.title ? `TITLE:${c.title}` : '',
			c.role ? `ROLE:${c.role}` : '',
			c.bday ? `BDAY:${c.bday}` : '',
			c.url ? `URL:${c.url}` : '',
			c.note ? `NOTE:${c.note}` : '',
			c.categories ? `CATEGORIES:${c.categories}` : '',
			c.tz ? `TZ:${c.tz}` : '',
			c.geo ? `GEO:${c.geo}` : '',
			`REV:${c.rev}`,
			`UID:${c.uid}`,
			'END:VCARD'
		].filter(Boolean).join('\r\n');

		const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${c.fn.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.vcf`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
