import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { WidgetExtensionsWindow } from "../bundle/widget-extensions";

export interface IEmailTemplate
{
	id: string;
	title: string;
	category: 'Transactional' | 'Marketing' | 'Security' | 'System';
	description: string;
	thumbnailIcon: string;
	htmlContent: string;
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& WidgetExtensionsWindow = self as unknown as any;

export class TemplateLibraryWidget extends widgetSelf.GenericSearchableWidget
{
	private templates: IEmailTemplate[] = [];
	private selectedCategory: string = 'all';
	private activeTemplateId: string = 'tmpl-1';

	private templatesGridEl!: HTMLElement;
	private livePreviewFrameEl!: HTMLIFrameElement;

	private _templateSelected: Signal<TemplateLibraryWidget, IEmailTemplate> = new Signal(this);
	public get templateSelected(): ISignal<TemplateLibraryWidget, IEmailTemplate> { return this._templateSelected; }

	constructor()
	{
		super();
		this.title.label = 'Email Templates';
		this.title.iconClass = 'bx bx-file-blank';
		this.title.closable = true;

		this.initMockTemplates();
		this.initDom();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderTemplates();
		this.loadActivePreview();
	}

	private initMockTemplates(): void
	{
		this.templates = [
			{
				id: 'tmpl-1',
				title: 'Welcome & Onboarding',
				category: 'Transactional',
				description: 'Clean introductory welcome email with prominent call-to-action buttons.',
				thumbnailIcon: '👋',
				htmlContent: `<!DOCTYPE html><html><body style="font-family:sans-serif; background:#f4f4f4; padding:20px;"><div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px;"><h2 style="color:#1a73e8;">Welcome aboard, Brian!</h2><p style="color:#555; line-height:1.5;">We are thrilled to have you in the cluster. Your workspace is fully provisioned and ready for deployment.</p><a href="#" style="display:inline-block; background:#1a73e8; color:#fff; padding:10px 20px; text-decoration:none; border-radius:4px; margin-top:16px;">Launch Dashboard</a></div></body></html>`
			},
			{
				id: 'tmpl-2',
				title: 'Security Advisory Alert',
				category: 'Security',
				description: 'High-priority warning template designed for critical security bulletins and patches.',
				thumbnailIcon: '🛡️',
				htmlContent: `<!DOCTYPE html><html><body style="font-family:sans-serif; background:#f4f4f4; padding:20px;"><div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px; border-top:4px solid #d93025;"><h2 style="color:#d93025;">Critical Security Advisory</h2><p style="color:#555; line-height:1.5;">We detected a security event affecting your worker bindings across the cluster. Immediate action is required.</p><a href="#" style="display:inline-block; background:#d93025; color:#fff; padding:10px 20px; text-decoration:none; border-radius:4px; margin-top:16px;">Review Security Log</a></div></body></html>`
			},
			{
				id: 'tmpl-3',
				title: 'Billing & Domain Renewal',
				category: 'Transactional',
				description: 'Structured invoice receipt layout for automated domain renewals and payments.',
				thumbnailIcon: '💳',
				htmlContent: `<!DOCTYPE html><html><body style="font-family:sans-serif; background:#f4f4f4; padding:20px;"><div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px;"><h2 style="color:#33b679;">Payment Successful</h2><p style="color:#555;">Your annual domain renewal for <strong>quake.games</strong> has been processed successfully.</p><table style="width:100%; margin-top:20px; border-collapse:collapse;"><tr style="border-bottom:1px solid #ddd;"><td style="padding:8px 0; color:#555;">Domain Registration</td><td style="padding:8px 0; text-align:right; font-weight:bold;">$20.00</td></tr></table></div></body></html>`
			},
			{
				id: 'tmpl-4',
				title: 'Developer Dispatch',
				category: 'Marketing',
				description: 'Multi-column release newsletter layout for WebGPU benchmarks and updates.',
				thumbnailIcon: '🚀',
				htmlContent: `<!DOCTYPE html><html><body style="font-family:sans-serif; background:#f4f4f4; padding:20px;"><div style="max-width:600px; margin:0 auto; background:#ffffff; padding:30px; border-radius:8px;"><h2 style="color:#111;">Claude Code Release Notes</h2><p style="color:#555; line-height:1.5;">Explore our latest benchmarks for running Qwen2.5-Coder directly inside browser environments with WebGPU acceleration.</p></div></body></html>`
			}
		];
	}

	private initDom(): void
	{
		this.addClass('et-manager-root');
		this.node.innerHTML = `
            <div class="et-layout-container">
                <!-- Left Pane: Library Navigation & Template Cards -->
                <div class="et-panel et-sidebar-panel">
                    <div class="et-panel-header">
                        <h3><i class="bx bx-bookmarks"></i> Template Library</h3>
                    </div>
                    <div class="et-search-box">
                        <i class="bx bx-search"></i>
                        <input type="text" id="etSearchInput" placeholder="Search templates..." />
                    </div>
                    <div class="et-category-pills">
                        <button class="et-pill active" data-cat="all">All</button>
                        <button class="et-pill" data-cat="Transactional">Transactional</button>
                        <button class="et-pill" data-cat="Security">Security</button>
                        <button class="et-pill" data-cat="Marketing">Marketing</button>
                    </div>
                    <div class="et-templates-list" id="etTemplatesGrid">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Right Pane: Live HTML Preview & Actions -->
                <div class="et-panel et-preview-panel">
                    <div class="et-preview-header">
                        <div class="et-preview-meta">
                            <h2 id="etActiveTitle">Select a Template</h2>
                            <span id="etActiveDesc">Choose a template from the left to inspect and deploy.</span>
                        </div>
                        <div class="et-preview-actions">
                            <div class="et-viewport-toggles">
                                <button class="et-view-btn active" data-view="desktop" title="Desktop View"><i class="bx bx-desktop"></i></button>
                                <button class="et-view-btn" data-view="mobile" title="Mobile View"><i class="bx bx-mobile"></i></button>
                            </div>
                            <button id="etUseTemplateBtn" class="et-btn primary" disabled><i class="bx bx-check"></i> Use Template</button>
                        </div>
                    </div>
                    <div class="et-iframe-wrapper desktop" id="etIframeWrapper">
                        <iframe id="etLivePreviewFrame" sandbox="allow-same-origin"></iframe>
                    </div>
                </div>
            </div>
        `;

		this.templatesGridEl = this.node.querySelector('#etTemplatesGrid') as HTMLElement;
		this.livePreviewFrameEl = this.node.querySelector('#etLivePreviewFrame') as HTMLIFrameElement;
		this.searchInput = this.node.querySelector('#etSearchInput') as HTMLInputElement;

		// Search & Category Bindings
		this.searchInput.addEventListener('input', () => this.renderTemplates());
		this.node.querySelectorAll('.et-pill').forEach(btn =>
		{
			btn.addEventListener('click', (e) =>
			{
				this.node.querySelectorAll('.et-pill').forEach(p => p.classList.remove('active'));
				const target = e.currentTarget as HTMLElement;
				target.classList.add('active');
				this.selectedCategory = target.getAttribute('data-cat') || 'all';
				this.renderTemplates();
			});
		});

		// Viewport Switcher
		this.node.querySelectorAll('.et-view-btn').forEach(btn =>
		{
			btn.addEventListener('click', (e) =>
			{
				this.node.querySelectorAll('.et-view-btn').forEach(b => b.classList.remove('active'));
				const target = e.currentTarget as HTMLElement;
				target.classList.add('active');
				const view = target.getAttribute('data-view');
				const wrapper = this.node.querySelector('#etIframeWrapper') as HTMLElement;
				wrapper.className = `et-iframe-wrapper ${view}`;
			});
		});

		// Use Template Action
		this.node.querySelector('#etUseTemplateBtn')?.addEventListener('click', () =>
		{
			const active = this.templates.find(t => t.id === this.activeTemplateId);
			if(active)
			{
				this._templateSelected.emit(active);
				alert(`Template "${active.title}" selected and loaded into composer!`);
			}
		});
	}

	private renderTemplates(): void
	{
		const query = this.searchInput?.value.toLowerCase();
		const filtered = query ? this.templates.filter(t =>
		{
			const matchesCat = this.selectedCategory === 'all' || t.category === this.selectedCategory;
			const matchesQuery = t.title.toLowerCase().includes(query) || t.description.toLowerCase().includes(query);
			return matchesCat && matchesQuery;
		}) : this.templates;

		this.templatesGridEl.innerHTML = '';
		if(filtered.length === 0)
		{
			this.templatesGridEl.innerHTML = `<div class="et-empty">No templates found</div>`;
			return;
		}

		filtered.forEach(t =>
		{
			const isSelected = t.id === this.activeTemplateId;
			const card = document.createElement('div');
			card.className = `et-template-card ${isSelected ? 'selected' : ''}`;
			card.innerHTML = `
                <div class="et-card-thumb">${t.thumbnailIcon}</div>
                <div class="et-card-info">
                    <span class="et-c-title">${this.escapeHTML(t.title)}</span>
                    <span class="et-c-cat">${t.category}</span>
                </div>
            `;

			card.addEventListener('click', () =>
			{
				this.activeTemplateId = t.id;
				this.renderTemplates();
				this.loadActivePreview();
			});

			this.templatesGridEl.appendChild(card);
		});
	}

	private loadActivePreview(): void
	{
		const active = this.templates.find(t => t.id === this.activeTemplateId);
		const titleEl = this.node.querySelector('#etActiveTitle') as HTMLElement;
		const descEl = this.node.querySelector('#etActiveDesc') as HTMLElement;
		const useBtn = this.node.querySelector('#etUseTemplateBtn') as HTMLButtonElement;

		if(!active) return;

		titleEl.textContent = active.title;
		descEl.textContent = active.description;
		useBtn.disabled = false;

		// Write HTML into iframe safely
		const doc = this.livePreviewFrameEl.contentDocument || this.livePreviewFrameEl.contentWindow?.document;
		if(doc)
		{
			doc.open();
			doc.write(active.htmlContent);
			doc.close();
		}
	}

}
