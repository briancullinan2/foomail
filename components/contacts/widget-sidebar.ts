import { Message } from "@lumino/messaging";
import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import { ParseVCard, VCardContact } from "./parse-vcf";
import type { ContactsWidget } from "./widget";


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& RepositorySettingsWindow = self as unknown as any;


export interface IContactsOptions
{
	contactsChanged: ISignal<ContactsWidget, VCardContact[]>;
}


export class ContactsSidebar extends Widget
{
	private isEditing: boolean = false;
	private groupListEl!: HTMLElement;
	private contacts: VCardContact[] = [];
	private contactListEl!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private selectedGroup: string = 'All';
	private filteredContacts: VCardContact[] = [];
	private selectedContactUid: string | null = null;

	private _selectedContact: Signal<ContactsSidebar, string> = new Signal(this);

	public get selectedContact(): ISignal<ContactsSidebar, string>
	{
		return this._selectedContact;
	}

	private _editContact: Signal<ContactsSidebar, boolean> = new Signal(this);

	public get editContact(): ISignal<ContactsSidebar, boolean>
	{
		return this._editContact;
	}

	private _contactsChanged: Signal<ContactsSidebar, VCardContact[]> = new Signal(this);

	public get contactsChanged(): ISignal<ContactsSidebar, VCardContact[]>
	{
		return this._contactsChanged;
	}

	private _mainpanelChanged?: ISignal<ContactsWidget, VCardContact[]>;
	private _mainpanelSub: (main: ContactsWidget, items: VCardContact[]) => void = (_, items) =>
	{
		this.contacts = items;
		this.renderGroups();
		this.filterAndRender();
	};


	constructor(title?: string, options?: IContactsOptions)
	{
		super();

		this.title.label = title ?? 'Groups';
		this.title.iconClass = 'bx bx-card-view-tiles';
		this.title.closable = true;
		this.addClass('contacts-sidebar');
		if(options?.contactsChanged)
		{
			this._mainpanelChanged = options.contactsChanged;
			this._mainpanelChanged.connect(this._mainpanelSub);
		}

		this._buildUI();

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
		this._contactsChanged.emit(this.contacts);
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
		this.loadSampleContacts();
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.renderGroups();
		this.filterAndRender();
	}


	protected override onAfterShow(msg: Message): void
	{
		super.onAfterShow(msg);
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		this._mainpanelChanged?.connect(this._mainpanelSub);
		this.renderGroups();
		this.filterAndRender();
	}


	protected override onBeforeDetach(msg: Message): void
	{
		this._mainpanelChanged?.disconnect(this._mainpanelSub);
		super.onBeforeDetach(msg);
	}


	private _buildUI(): void
	{
		this.node.innerHTML = `
			<div class="cm-search-bar">
				<i class="bx bx-search"></i>
				<input type="text" id="cmSearchInput" placeholder="Search contacts or details..." />
				<button id="cmAddContactBtn" class="cm-btn primary" title="Add Contact"><i class="bx bx-plus"></i></button>
			</div>
			<div class="cm-group-list" id="cmGroupList">
				<!-- Populated dynamically -->
			</div>
			<div class="cm-contact-items" id="cmContactItems">
				<!-- Populated dynamically -->
			</div>`;

		this.groupListEl = this.node.querySelector('#cmGroupList') as HTMLElement;
		this.contactListEl = this.node.querySelector('#cmContactItems') as HTMLElement;
		this.searchInput = this.node.querySelector('#cmSearchInput') as HTMLInputElement;

		// Bind events
		this.searchInput.addEventListener('input', () => this.filterAndRender());

		const addBtn = this.node.querySelector('#cmAddContactBtn');
		addBtn?.addEventListener('click', () => this.createNewContact());
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
				this._selectedContact.emit(c.uid);
				this.isEditing = false;
				this._editContact.emit(false);
				this.renderContactList();
			});
			this.contactListEl.appendChild(card);
		});
	}

	private createNewContact(): void
	{
		const newC = ParseVCard.createNewContact();
		this.contacts.push(newC);
		this.selectedContactUid = newC.uid;
		this.isEditing = true;
		this._editContact.emit(true);
		this.renderGroups();
		this.filterAndRender();
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

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
