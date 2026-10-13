import { Widget } from "@lumino/widgets";
import { Message } from "@lumino/messaging";
import { GithubSettings } from "./widget-github";
import { AceEditorSettings } from "./widget-editor";
import { XtermSettings } from "./widget-xterm";
import { PathsSettings } from "./widget-paths";
import { CoreSettings } from "./widget-core";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

export class SettingsWidget extends Widget
{
	constructor()
	{
		super();
		this.title.label = 'System Settings & Configs';
		this.title.iconClass = 'bx bx-cog';
		this.title.closable = true;

		this.initDom();
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

	private initDom(): void
	{
		this.addClass('settings-dashboard-root');
		this.node.innerHTML = `
            <div class="settings-container">
                <header class="settings-header">
                    <h2><i class="bx bx-slider-alt"></i> Control Center & Settings Hub</h2>
                    <p>Manage core runtime environments, GitHub repository sync feeds, Ace 9 editor configurations, Xterm terminal logs, and shared storage paths.</p>
                </header>

                <div class="settings-accordion" id="settingsAccordion">
                    <!-- Accordion Sections Populated via Sub-Widgets -->
                </div>
            </div>
        `;

		const accordionContainer = this.node.querySelector('#settingsAccordion') as HTMLElement;

		// Instantiate and mount sub-widgets into accordion sections
		const sections = [
			{ title: 'Core Environment & Layout Settings', icon: 'bx-server', widget: new CoreSettings() },
			{ title: 'GitHub Repositories & Sync Feeds', icon: 'bx-git-repo-forked', widget: new GithubSettings() },
			{ title: 'Ace 9 Code Editor Settings', icon: 'bx-code-block', widget: new AceEditorSettings() },
			{ title: 'Xterm.js Terminal History & Logs', icon: 'bx-terminal', widget: new XtermSettings() },
			{ title: 'Shared Google Drives & HTTPS Paths', icon: 'bx-folder-open', widget: new PathsSettings() }
		];

		sections.forEach((sec, idx) =>
		{
			const sectionEl = document.createElement('div');
			sectionEl.className = `accordion-item ${idx === 0 ? 'active' : ''}`;
			sectionEl.innerHTML = `
                <div class="accordion-header">
                    <div class="accordion-title-wrap">
                        <i class="bx ${sec.icon}"></i>
                        <span>${sec.title}</span>
                    </div>
                    <i class="bx bx-chevron-down accordion-arrow"></i>
                </div>
                <div class="accordion-content-pane" style="${idx === 0 ? '' : 'display:none;'}"></div>
            `;

			const headerEl = sectionEl.querySelector('.accordion-header') as HTMLElement;
			const contentPane = sectionEl.querySelector('.accordion-content-pane') as HTMLElement;

			headerEl.addEventListener('click', () =>
			{
				const isOpen = contentPane.style.display !== 'none';
				// Toggle current
				contentPane.style.display = isOpen ? 'none' : 'block';
				sectionEl.classList.toggle('active', !isOpen);
			});

			// Mount sub-widget into pane
			sec.widget.node.style.height = '100%';
			contentPane.appendChild(sec.widget.node);
			sec.widget.update();

			accordionContainer.appendChild(sectionEl);
		});
	}
}
