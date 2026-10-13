import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";

export interface IContact
{
	id: string;
	name: string;
	email: string;
	company?: string;
	avatar: string;
}

export interface IContactGroup
{
	id: string;
	name: string;
	description?: string;
	memberIds: string[];
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

export class GroupsWidget extends Widget
{
	private contacts: IContact[] = [];
	private groups: IContactGroup[] = [];
	private selectedGroupId: string | null = 'grp-1';
	private searchInput!: HTMLInputElement;
	private directoryListEl!: HTMLElement;
	private groupsListEl!: HTMLElement;
	private groupMembersEl!: HTMLElement;
	private activeGroupTitleEl!: HTMLElement;
	private activeGroupDescEl!: HTMLElement;

	private _groupsChanged: Signal<GroupsWidget, IContactGroup[]> = new Signal(this);
	public get groupsChanged(): ISignal<GroupsWidget, IContactGroup[]> { return this._groupsChanged; }

	constructor()
	{
		super();
		this.title.label = 'Contact Groups';
		this.title.iconClass = 'bx bx-group';
		this.title.closable = true;

		this.initMockData();
		this.initDom();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderAll();
	}

	private initMockData(): void
	{
		this.contacts = [
			{ id: 'c-1', name: 'Alice Sterling', email: 'alice.s@pryor.games', company: 'Pryor Games', avatar: 'AS' },
			{ id: 'c-2', name: 'Marcus Vance', email: 'vance@quake.games', company: 'Quake Studios', avatar: 'MV' },
			{ id: 'c-3', name: 'Elena Rostova', email: 'elena@sixdegrees.org', company: 'SixDegrees', avatar: 'ER' },
			{ id: 'c-4', name: 'David Chen', email: 'dchen@anthropic.com', company: 'Anthropic', avatar: 'DC' },
			{ id: 'c-5', name: 'Sarah Jenkins', email: 'sjenkins@github.com', company: 'GitHub', avatar: 'SJ' },
			{ id: 'c-6', name: 'Brian Cullinan', email: 'brian@briancullinan.com', company: 'Independent', avatar: 'BC' }
		];

		this.groups = [
			{
				id: 'grp-1',
				name: 'Core Architecture Team',
				description: 'Engineering leads across cluster infrastructure and WebAssembly runtimes.',
				memberIds: ['c-1', 'c-2', 'c-4']
			},
			{
				id: 'grp-2',
				name: 'Foundations Board',
				description: 'External advisors and foundation representatives.',
				memberIds: ['c-3', 'c-5']
			}
		];
	}

	private initDom(): void
	{
		this.addClass('cg-manager-root');
		this.node.innerHTML = `
            <div class="cg-layout-container">
                <!-- Column 1: Directory Master Contacts -->
                <div class="cg-panel cg-directory-panel">
                    <div class="cg-panel-header">
                        <h3><i class="bx bx-address-book"></i> All Contacts</h3>
                        <button id="cgNewContactBtn" class="cg-icon-btn" title="Create Contact"><i class="bx bx-user-plus"></i></button>
                    </div>
                    <div class="cg-search-box">
                        <i class="bx bx-search"></i>
                        <input type="text" id="cgContactSearch" placeholder="Search directory..." />
                    </div>
                    <div class="cg-list-container" id="cgDirectoryList">
                        <!-- Rendered dynamically -->
                    </div>
                </div>

                <!-- Column 2: Contact Lists / Groups -->
                <div class="cg-panel cg-groups-panel">
                    <div class="cg-panel-header">
                        <h3><i class="bx bx-list-ul"></i> Your Contact Lists</h3>
                        <button id="cgNewGroupBtn" class="cg-icon-btn primary" title="New Contact List"><i class="bx bx-plus"></i></button>
                    </div>
                    <div class="cg-list-container" id="cgGroupsList">
                        <!-- Rendered dynamically -->
                    </div>
                </div>

                <!-- Column 3: Active Group Roster & Management -->
                <div class="cg-panel cg-roster-panel" id="cgDropZone">
                    <div class="cg-roster-header">
                        <div class="cg-roster-info">
                            <h2 id="cgActiveGroupTitle">Select a List</h2>
                            <p id="cgActiveGroupDesc">Select a contact list from the middle column to view or manage members.</p>
                        </div>
                        <div class="cg-roster-actions">
                            <button id="cgEmailGroupBtn" class="cg-btn secondary" disabled><i class="bx bx-envelope"></i> Email List</button>
                            <button id="cgDeleteGroupBtn" class="cg-btn danger-text" title="Delete Group" disabled><i class="bx bx-trash"></i></button>
                        </div>
                    </div>
                    <div class="cg-roster-sub-header">
                        <span>Group Members</span>
                        <span class="cg-hint-text"><i class="bx bx-info-circle"></i> Drag or click contacts to add</span>
                    </div>
                    <div class="cg-list-container" id="cgGroupMembersList">
                        <!-- Rendered dynamically -->
                    </div>
                </div>
            </div>
        `;

		this.directoryListEl = this.node.querySelector('#cgDirectoryList') as HTMLElement;
		this.groupsListEl = this.node.querySelector('#cgGroupsList') as HTMLElement;
		this.groupMembersEl = this.node.querySelector('#cgGroupMembersList') as HTMLElement;
		this.activeGroupTitleEl = this.node.querySelector('#cgActiveGroupTitle') as HTMLElement;
		this.activeGroupDescEl = this.node.querySelector('#cgActiveGroupDesc') as HTMLElement;
		this.searchInput = this.node.querySelector('#cgContactSearch') as HTMLInputElement;

		this.searchInput.addEventListener('input', () => this.renderDirectory());

		// Create new contact list / group button
		this.node.querySelector('#cgNewGroupBtn')?.addEventListener('click', () =>
		{
			const name = prompt('Enter new contact list name:');
			if(name)
			{
				const newGroup: IContactGroup = {
					id: 'grp-' + Math.random().toString(36).substring(2, 9),
					name: name.trim(),
					description: 'Custom distribution list',
					memberIds: []
				};
				this.groups.push(newGroup);
				this.selectedGroupId = newGroup.id;
				this.renderAll();
				this._groupsChanged.emit(this.groups);
			}
		});

		// Delete active group button
		this.node.querySelector('#cgDeleteGroupBtn')?.addEventListener('click', () =>
		{
			if(!this.selectedGroupId) return;
			if(confirm('Are you sure you want to delete this contact list?'))
			{
				this.groups = this.groups.filter(g => g.id !== this.selectedGroupId);
				this.selectedGroupId = this.groups[0]?.id || null;
				this.renderAll();
				this._groupsChanged.emit(this.groups);
			}
		});

		// Drag and drop assignment support into the roster panel
		const dropZone = this.node.querySelector('#cgDropZone') as HTMLElement;
		dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
		dropZone.addEventListener('drop', (e) =>
		{
			e.preventDefault();
			e.stopPropagation();
			const contactId = e.dataTransfer?.getData('text/plain');
			if(contactId && this.selectedGroupId)
			{
				this.addContactToActiveGroup(contactId);
			}
		});
	}

	private renderAll(): void
	{
		this.renderDirectory();
		this.renderGroupsList();
		this.renderActiveGroupRoster();
	}

	private renderDirectory(): void
	{
		const query = this.searchInput.value.toLowerCase();
		const filtered = this.contacts.filter(c =>
			c.name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query) || (c.company && c.company.toLowerCase().includes(query))
		);

		this.directoryListEl.innerHTML = '';
		if(filtered.length === 0)
		{
			this.directoryListEl.innerHTML = `<div class="cg-empty">No matching contacts</div>`;
			return;
		}

		filtered.forEach(c =>
		{
			const item = document.createElement('div');
			item.className = 'cg-contact-card';
			item.draggable = true;
			item.innerHTML = `
                <div class="cg-avatar">${c.avatar}</div>
                <div class="cg-contact-info">
                    <span class="cg-c-name">${this.escapeHTML(c.name)}</span>
                    <span class="cg-c-email">${this.escapeHTML(c.email)}</span>
                </div>
                <button class="cg-add-quick-btn" title="Add to active group"><i class="bx bx-plus"></i></button>
            `;

			// Setup HTML5 Drag
			item.addEventListener('dragstart', (e) =>
			{
				e.dataTransfer?.setData('text/plain', c.id);
			});

			// Quick add button click
			item.querySelector('.cg-add-quick-btn')?.addEventListener('click', (e) =>
			{
				e.stopPropagation();
				this.addContactToActiveGroup(c.id);
			});

			this.directoryListEl.appendChild(item);
		});
	}

	private renderGroupsList(): void
	{
		this.groupsListEl.innerHTML = '';
		if(this.groups.length === 0)
		{
			this.groupsListEl.innerHTML = `<div class="cg-empty">No contact lists created</div>`;
			return;
		}

		this.groups.forEach(g =>
		{
			const isSelected = g.id === this.selectedGroupId;
			const item = document.createElement('div');
			item.className = `cg-group-item ${isSelected ? 'selected' : ''}`;
			item.innerHTML = `
                <div class="cg-group-icon"><i class="bx bx-folder"></i></div>
                <div class="cg-group-details">
                    <span class="cg-g-name">${this.escapeHTML(g.name)}</span>
                    <span class="cg-g-count">${g.memberIds.length} members</span>
                </div>
            `;

			item.addEventListener('click', () =>
			{
				this.selectedGroupId = g.id;
				this.renderGroupsList();
				this.renderActiveGroupRoster();
			});

			this.groupsListEl.appendChild(item);
		});
	}

	private renderActiveGroupRoster(): void
	{
		const activeGroup = this.groups.find(g => g.id === this.selectedGroupId);
		const emailBtn = this.node.querySelector('#cgEmailGroupBtn') as HTMLButtonElement;
		const deleteBtn = this.node.querySelector('#cgDeleteGroupBtn') as HTMLButtonElement;

		if(!activeGroup)
		{
			this.activeGroupTitleEl.textContent = 'Select a List';
			this.activeGroupDescEl.textContent = 'Choose a contact list from the middle column to view or manage members.';
			this.groupMembersEl.innerHTML = `<div class="cg-empty">No list selected</div>`;
			emailBtn.disabled = true;
			deleteBtn.disabled = true;
			return;
		}

		this.activeGroupTitleEl.textContent = activeGroup.name;
		this.activeGroupDescEl.textContent = activeGroup.description || 'Distribution list';
		emailBtn.disabled = false;
		deleteBtn.disabled = false;

		this.groupMembersEl.innerHTML = '';
		if(activeGroup.memberIds.length === 0)
		{
			this.groupMembersEl.innerHTML = `
                <div class="cg-empty-roster">
                    <i class="bx bx-user-plus"></i>
                    <p>This list is empty. Drag contacts from the left panel or click '+' to add members.</p>
                </div>
            `;
			return;
		}

		activeGroup.memberIds.forEach(id =>
		{
			const contact = this.contacts.find(c => c.id === id);
			if(!contact) return;

			const row = document.createElement('div');
			row.className = 'cg-roster-member-row';
			row.innerHTML = `
                <div class="cg-avatar">${contact.avatar}</div>
                <div class="cg-contact-info">
                    <span class="cg-c-name">${this.escapeHTML(contact.name)}</span>
                    <span class="cg-c-email">${this.escapeHTML(contact.email)}</span>
                </div>
                <button class="cg-remove-btn" title="Remove from list"><i class="bx bx-x"></i></button>
            `;

			row.querySelector('.cg-remove-btn')?.addEventListener('click', () =>
			{
				activeGroup.memberIds = activeGroup.memberIds.filter(mId => mId !== id);
				this.renderAll();
				this._groupsChanged.emit(this.groups);
			});

			this.groupMembersEl.appendChild(row);
		});
	}

	private addContactToActiveGroup(contactId: string): void
	{
		const activeGroup = this.groups.find(g => g.id === this.selectedGroupId);
		if(!activeGroup)
		{
			alert('Please select a contact list first.');
			return;
		}

		if(!activeGroup.memberIds.includes(contactId))
		{
			activeGroup.memberIds.push(contactId);
			this.renderAll();
			this._groupsChanged.emit(this.groups);
		}
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
