import { Message } from "@lumino/messaging";
import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import { ParseVCard, VCardContact } from "./parse-vcf";
import type { ContactsWidget } from "./widget";
import type { IMainpanelOptions, WidgetExtensionsWindow } from '../bundle/widget-extensions';


const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& RepositorySettingsWindow & WidgetExtensionsWindow = self as unknown as any;


export class ContactsSidebar extends widgetSelf.SidebarChangeWidget<ContactsWidget, VCardContact>
{
	private groupListEl!: HTMLElement;
	private contactListEl!: HTMLElement;
	private selectedGroup: string = 'All';
	private filteredContacts: VCardContact[] = [];

	constructor(title?: string, options?: IMainpanelOptions<ContactsWidget, VCardContact[]>)
	{
		super(ContactsSidebar.name, title ?? 'Groups', options);

		this.addClass('contacts-sidebar');

		this._buildUI();

	}

	private loadSampleContacts(): void
	{
		this.items = [
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
		this.filterAndRender();
		this._itemsChanged.emit(this.items);
	}


	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.loadSampleContacts();
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
		groupsMap.set('All', this.items?.length ?? 0);

		this.items?.forEach(c =>
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
                <span><i class="bx bx-folder"></i> ${this.escapeHtml(groupName)}</span>
                <span class="cm-count">${count}</span>
            `;
			item.addEventListener('click', () =>
			{
				this.selectedGroup = groupName;
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
			const isSelected = c.uid === this._selectedItemId;
			const card = document.createElement('div');
			card.className = `cm-contact-card ${isSelected ? 'selected' : ''}`;
			card.innerHTML = `
                <div class="cm-avatar">${c.fn.charAt(0).toUpperCase()}</div>
                <div class="cm-contact-preview">
                    <span class="cm-name">${this.escapeHtml(c.fn)}</span>
                    <span class="cm-org">${this.escapeHtml(c.org || c.title || 'No Organization')}</span>
                </div>
            `;
			card.addEventListener('click', () =>
			{
				this._selectedItemId = c.uid;
				this._selectedItem.emit(c);
				this.isEditing = false;
				this._editItem.emit(false);
				this.renderContactList();
			});
			this.contactListEl.appendChild(card);
		});
	}

	private createNewContact(): void
	{
		const newC = ParseVCard.createNewContact();
		this.items?.push(newC);
		this._selectedItemId = newC.uid;
		this.isEditing = true;
		this._editItem.emit(true);
		this.filterAndRender();
	}

	protected filterAndRender(): void
	{
		this.renderGroups();

		const query = this.searchInput?.value.toLowerCase();
		if(!query)
		{
			this.filteredContacts = this.items ?? [];
			this.renderContactList();
			return;
		}
		this.filteredContacts = this.items?.filter(c =>
		{
			const matchesGroup = this.selectedGroup === 'All' || c.categories === this.selectedGroup;
			const matchesQuery = c.fn.toLowerCase().includes(query) ||
				c.email.toLowerCase().includes(query) ||
				c.org.toLowerCase().includes(query) ||
				c.tel.toLowerCase().includes(query);
			return matchesGroup && matchesQuery;
		}) ?? [];

		this.renderContactList();
	}

}
