import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { WidgetExtensionsWindow } from "../bundle/widget-extensions";

export interface ISignatureProfile
{
	id: string;
	name: string;
	htmlContent: string;
	isDefault: boolean;
}

export interface ISignatureTemplate
{
	id: string;
	title: string;
	category: string;
	previewThumb: string;
	htmlContent: string;
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& WidgetExtensionsWindow = self as unknown as any;

export class SignatureWidget extends widgetSelf.GenericSearchableWidget
{
	private signatures: ISignatureProfile[] = [];
	private templates: ISignatureTemplate[] = [];
	private activeSignatureId: string | null = 'sig-1';

	private nameInput!: HTMLInputElement;
	private editorTextArea!: HTMLTextAreaElement;
	private livePreviewEl!: HTMLElement;
	private savedListEl!: HTMLElement;
	private defaultSelectEl!: HTMLSelectElement;
	private templatesScrollerEl!: HTMLElement;

	private _signaturesChanged: Signal<SignatureWidget, ISignatureProfile[]> = new Signal(this);
	public get signaturesChanged(): ISignal<SignatureWidget, ISignatureProfile[]> { return this._signaturesChanged; }

	constructor()
	{
		super();
		this.title.label = 'Email Signatures';
		this.title.iconClass = 'bx bx-edit-alt';
		this.title.closable = true;

		this.initTemplates();
		this.initDefaultSignatures();
		this.initDom();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderAll();
	}

	private initTemplates(): void
	{
		this.templates = [
			{
				id: 'tmpl-1',
				title: 'Modern Minimal',
				category: 'Professional',
				previewThumb: '✒️',
				htmlContent: `<div style="font-family:sans-serif; color:#333; font-size:13px;">\n  <p style="margin:0; font-weight:bold; font-size:15px; color:#1a73e8;">Brian Cullinan</p>\n  <p style="margin:2px 0 8px 0; color:#666; font-size:12px;">Principal Architect | Pryor Games</p>\n  <hr style="border:none; border-top:1px solid #ddd; margin:8px 0;" />\n  <p style="margin:0; font-size:11px; color:#888;">🌐 briancullinan.com | ⚡ quake.games</p>\n</div>`
			},
			{
				id: 'tmpl-2',
				title: 'Executive Bold',
				category: 'Corporate',
				previewThumb: '👔',
				htmlContent: `<div style="font-family:Georgia,serif; color:#111; font-size:13px; border-left:3px solid #d93025; padding-left:10px;">\n  <p style="margin:0; font-weight:bold; font-size:16px;">Brian Cullinan</p>\n  <p style="margin:2px 0 6px 0; font-style:italic; color:#555; font-size:12px;">Foundations Board Member</p>\n  <p style="margin:0; font-size:11px; color:#336699;">📧 contact@sixdegrees.org</p>\n</div>`
			},
			{
				id: 'tmpl-3',
				title: 'Developer Terminal',
				category: 'Tech & Code',
				previewThumb: '💻',
				htmlContent: `<div style="font-family:monospace; background:#1e1e1e; color:#33b679; padding:12px; border-radius:6px; font-size:12px;">\n  <p style="margin:0; color:#ffffff;">$ whoami --verbose</p>\n  <p style="margin:4px 0 0 0; color:#1a73e8;">Brian Cullinan // Systems & WebAssembly</p>\n  <p style="margin:2px 0 0 0; color:#888;">[github.com/briancullinan]</p>\n</div>`
			},
			{
				id: 'tmpl-4',
				title: 'Creative Gradient',
				category: 'Design',
				previewThumb: '🎨',
				htmlContent: `<div style="font-family:sans-serif; background:linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding:12px; border-radius:8px; color:#333; font-size:13px;">\n  <p style="margin:0; font-weight:bold; font-size:15px; color:#2c3e50;">Brian Cullinan</p>\n  <p style="margin:2px 0 8px 0; font-size:12px; color:#7f8c8d;">Creative Technologist</p>\n  <p style="margin:0; font-size:11px; color:#e74c3c;">🔥 Let's build the future of browser runtimes.</p>\n</div>`
			}
		];
	}

	private initDefaultSignatures(): void
	{
		this.signatures = [
			{
				id: 'sig-1',
				name: 'Default Work Signature',
				htmlContent: this.templates[0].htmlContent,
				isDefault: true
			},
			{
				id: 'sig-2',
				name: 'Quick Reply / Short',
				htmlContent: `<div style="font-family:sans-serif; font-size:12px; color:#555;"><p style="margin:0;">-- Brian C.</p></div>`,
				isDefault: false
			}
		];
	}

	private initDom(): void
	{
		this.addClass('sig-editor-root');
		this.node.innerHTML = `
            <div class="sig-container">
                <!-- Top Section: Horizontal Scroller of Predefined Templates -->
                <div class="sig-section-header">
                    <h3><i class="bx bx-layout"></i> Predefined Signature Templates</h3>
                    <span>Click any template to apply its style</span>
                </div>
                <div class="sig-templates-scroller" id="sigTemplatesScroller">
                    <!-- Populated dynamically -->
                </div>

                <hr class="sig-divider" />

                <!-- Middle Section: Editor & Live Preview Split -->
                <div class="sig-editor-workspace">
                    <div class="sig-pane">
                        <div class="sig-pane-header">
                            <h3><i class="bx bx-code-block"></i> Signature HTML Editor</h3>
                            <div class="sig-name-group">
                                <label>Profile Name:</label>
                                <input type="text" id="sigProfileNameInput" placeholder="Signature Name" />
                            </div>
                        </div>
                        <textarea id="sigHtmlTextArea" class="sig-textarea" placeholder="Enter custom HTML signature styles..."></textarea>
                        <div class="sig-editor-footer">
                            <button id="sigSaveBtn" class="sig-btn primary"><i class="bx bx-save"></i> Save / Update Signature</button>
                            <button id="sigNewBtn" class="sig-btn secondary"><i class="bx bx-plus"></i> New Profile</button>
                        </div>
                    </div>

                    <div class="sig-pane">
                        <div class="sig-pane-header">
                            <h3><i class="bx bx-show"></i> Live Rendered Preview</h3>
                        </div>
                        <div class="sig-live-preview-box" id="sigLivePreview">
                            <!-- Rendered HTML preview -->
                        </div>
                    </div>
                </div>

                <hr class="sig-divider" />

                <!-- Bottom Section: Saved Signatures List & Default Selector Dropdown -->
                <div class="sig-bottom-toolbar">
                    <div class="sig-default-selector-wrap">
                        <label for="sigDefaultDropdown"><i class="bx bx-check-shield"></i> Default Active Signature:</label>
                        <select id="sigDefaultDropdown" class="sig-select">
                            <!-- Populated dynamically -->
                        </select>
                    </div>

                    <div class="sig-saved-list-wrap">
                        <h4>Saved Profiles</h4>
                        <div class="sig-saved-chips" id="sigSavedChipsContainer">
                            <!-- Populated dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;

		this.templatesScrollerEl = this.node.querySelector('#sigTemplatesScroller') as HTMLElement;
		this.nameInput = this.node.querySelector('#sigProfileNameInput') as HTMLInputElement;
		this.editorTextArea = this.node.querySelector('#sigHtmlTextArea') as HTMLTextAreaElement;
		this.livePreviewEl = this.node.querySelector('#sigLivePreview') as HTMLElement;
		this.savedListEl = this.node.querySelector('#sigSavedChipsContainer') as HTMLElement;
		this.defaultSelectEl = this.node.querySelector('#sigDefaultDropdown') as HTMLSelectElement;

		// Bind Live Editor Events
		this.editorTextArea.addEventListener('input', () =>
		{
			this.updateLivePreview(this.editorTextArea.value);
		});

		this.node.querySelector('#sigSaveBtn')?.addEventListener('click', () => this.saveActiveProfile());
		this.node.querySelector('#sigNewBtn')?.addEventListener('click', () => this.createNewProfile());

		this.defaultSelectEl.addEventListener('change', () =>
		{
			const selectedId = this.defaultSelectEl.value;
			this.signatures.forEach(s => s.isDefault = (s.id === selectedId));
			this._signaturesChanged.emit(this.signatures);
			this.renderSavedList();
		});
	}

	private renderAll(): void
	{
		this.renderTemplatesScroller();
		this.renderSavedList();
		this.renderDefaultDropdown();
		this.loadProfileIntoEditor(this.activeSignatureId);
	}

	private renderTemplatesScroller(): void
	{
		this.templatesScrollerEl.innerHTML = '';
		this.templates.forEach(t =>
		{
			const card = document.createElement('div');
			card.className = 'sig-template-card';
			card.innerHTML = `
                <div class="sig-tmpl-thumb">${t.previewThumb}</div>
                <div class="sig-tmpl-info">
                    <span class="sig-tmpl-title">${this.escapeHTML(t.title)}</span>
                    <span class="sig-tmpl-cat">${this.escapeHTML(t.category)}</span>
                </div>
            `;
			card.addEventListener('click', () =>
			{
				this.editorTextArea.value = t.htmlContent;
				this.updateLivePreview(t.htmlContent);
			});
			this.templatesScrollerEl.appendChild(card);
		});
	}

	private renderSavedList(): void
	{
		this.savedListEl.innerHTML = '';
		this.signatures.forEach(sig =>
		{
			const isActive = sig.id === this.activeSignatureId;
			const chip = document.createElement('div');
			chip.className = `sig-chip ${isActive ? 'active' : ''} ${sig.isDefault ? 'is-default' : ''}`;
			chip.innerHTML = `
                <i class="bx bx-file"></i>
                <span class="sig-chip-name">${this.escapeHTML(sig.name)}</span>
                ${sig.isDefault ? '<span class="sig-default-badge">Default</span>' : ''}
            `;
			chip.addEventListener('click', () =>
			{
				this.activeSignatureId = sig.id;
				this.renderSavedList();
				this.loadProfileIntoEditor(sig.id);
			});
			this.savedListEl.appendChild(chip);
		});
	}

	private renderDefaultDropdown(): void
	{
		this.defaultSelectEl.innerHTML = '';
		this.signatures.forEach(sig =>
		{
			const opt = document.createElement('option');
			opt.value = sig.id;
			opt.textContent = sig.name;
			opt.selected = sig.isDefault;
			this.defaultSelectEl.appendChild(opt);
		});
	}

	private loadProfileIntoEditor(id: string | null): void
	{
		const profile = this.signatures.find(s => s.id === id);
		if(!profile) return;
		this.nameInput.value = profile.name;
		this.editorTextArea.value = profile.htmlContent;
		this.updateLivePreview(profile.htmlContent);
	}

	private updateLivePreview(html: string): void
	{
		this.livePreviewEl.innerHTML = html;
	}

	private saveActiveProfile(): void
	{
		const profile = this.signatures.find(s => s.id === this.activeSignatureId);
		if(!profile) return;

		profile.name = this.nameInput.value.trim() || 'Untitled Signature';
		profile.htmlContent = this.editorTextArea.value;

		this.renderSavedList();
		this.renderDefaultDropdown();
		this._signaturesChanged.emit(this.signatures);
		alert('Signature profile successfully saved!');
	}

	private createNewProfile(): void
	{
		const newSig: ISignatureProfile = {
			id: 'sig-' + Math.random().toString(36).substring(2, 9),
			name: 'New Custom Signature',
			htmlContent: `<div style="font-family:sans-serif; font-size:13px;"><p style="margin:0;">Best regards,</p><p style="margin:4px 0 0 0; font-weight:bold;">Your Name</p></div>`,
			isDefault: false
		};
		this.signatures.push(newSig);
		this.activeSignatureId = newSig.id;
		this.renderAll();
		this._signaturesChanged.emit(this.signatures);
	}

}
