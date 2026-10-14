import { Widget } from '@lumino/widgets';
import { ParseVCard, VCardContact } from './parse-vcf';
import { Message } from '@lumino/messaging';
import { ContactsSidebar } from './widget-sidebar';
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from '../bundle/menu.d';
import type { LuminoLayoutWindow } from '../bundle/lumino.d';
import { ISignal, Signal } from '@lumino/signaling';
import type { WidgetExtensionsWindow } from '../bundle/widget-extensions';

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& RepositorySettingsWindow & WidgetExtensionsWindow = self as unknown as any;

export class ContactsWidget extends widgetSelf.WithChangingWidget<ContactsWidget, VCardContact>
{
	private detailPaneEl!: HTMLElement;

	constructor(title?: string)
	{
		super(title);
		this.addClass('lumino-contact-manager');
		this.initDOM();
	}


	private initDOM(): void
	{
		this.node.innerHTML = `
			<div class="cm-detail-pane" id="cmDetailPane">
				<div class="cm-empty-state">
					<i class="bx bx-user-pin"></i>
					<p>Select a contact to view or edit full vCard attributes.</p>
				</div>
			</div>`;

		// Cache DOM elements
		this.detailPaneEl = this.node.querySelector('#cmDetailPane') as HTMLElement;
		this._sidebarWidget = new ContactsSidebar(undefined, {
			itemsChanged: this.itemsChanged
		});
		this.resubscribeSidebar();
	}

	// --- DropFiles implementation for VCF parsing ---
	public async dropFiles(files: FileList): Promise<void>
	{
		const contacts = [];
		for(let i = 0; i < files.length; i++)
		{
			const file = files[i];
			const text = await file.text();
			const newItems = ParseVCard.parseVCardString(text);
			contacts.push(...newItems);
		}
		// this.renderGroups();
		// this.filterAndRender();
		this._itemsChanged.emit(contacts);
	}

	protected filterAndRender(): void
	{
		const contact = this.items?.find(c => c.uid === this._selectedItemId);
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
			this.filterAndRender();
		});

		this.detailPaneEl.querySelector('#cmExportVcfBtn')?.addEventListener('click', () =>
		{
			ParseVCard.exportSingleVCard(c);
		});

		this.detailPaneEl.querySelector('#cmDeleteBtn')?.addEventListener('click', () =>
		{
			if(confirm(`Delete contact "${c.fn}"?`))
			{
				this.items = this.items?.filter(item => item.uid !== c.uid);
				this._selectedItemId = undefined;
				this._itemsChanged.emit(this.items ?? []);
				// this.renderGroups();
				// this.filterAndRender();
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
			this._itemsChanged.emit([c]);
			this.filterAndRender();
		});

		this.detailPaneEl.querySelector('#cmCancelBtn')?.addEventListener('click', () =>
		{
			this.isEditing = false;
			this.filterAndRender();
		});
	}

}
