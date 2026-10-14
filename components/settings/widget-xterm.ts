import { Widget } from "@lumino/widgets";

export class XtermSettings extends Widget
{
	private history: string[] = [
		'npm run build:wasm',
		'git pull origin main',
		'docker-compose up --build',
		'./scripts/deploy_cluster.sh'
	];

	private historyListEl!: HTMLElement;

	constructor()
	{
		super();
		this.initDom();
	}

	protected override onAfterAttach(msg: any): void
	{
		super.onAfterAttach(msg);
		this.renderHistory();
	}

	private initDom(): void
	{
		this.addClass('sub-widget-pane');
		this.node.innerHTML = `
            <div class="xterm-settings-container">
                <div class="xterm-toolbar">
                    <span class="xterm-title"><i class="bx bx-history"></i> Terminal Command History & Ring Buffer</span>
                    <button id="xtermClearBtn" class="config-btn danger"><i class="bx bx-trash"></i> Clear History</button>
                </div>
                <div class="xterm-history-list" id="xtermHistoryList">
                    <!-- Populated dynamically -->
                </div>
            </div>
        `;

		this.historyListEl = this.node.querySelector('#xtermHistoryList') as HTMLElement;
		this.node.querySelector('#xtermClearBtn')?.addEventListener('click', () =>
		{
			this.history = [];
			this.renderHistory();
		});
	}

	private renderHistory(): void
	{
		this.historyListEl.innerHTML = '';
		if(this.history.length === 0)
		{
			this.historyListEl.innerHTML = `<div class="config-empty">Terminal history buffer is empty.</div>`;
			return;
		}

		this.history.forEach((cmd, idx) =>
		{
			const row = document.createElement('div');
			row.className = 'xterm-history-row';
			row.innerHTML = `
                <span class="xterm-cmd-num">${idx + 1}</span>
                <code class="xterm-cmd-text">${cmd}</code>
                <button class="xterm-del-btn" data-index="${idx}"><i class="bx bx-x"></i></button>
            `;

			row.querySelector('.xterm-del-btn')?.addEventListener('click', () =>
			{
				this.history.splice(idx, 1);
				this.renderHistory();
			});

			this.historyListEl.appendChild(row);
		});
	}
}
