import { Widget } from "@lumino/widgets";

export class PathsSettings extends Widget
{
	private paths: { id: string; type: 'Drive' | 'HTTPS'; name: string; target: string; }[] = [
		{ id: '1', type: 'Drive', name: 'Shared Team Vault (Google Drive)', target: 'gdrive://shared-cluster-vault-v9' },
		{ id: '2', type: 'HTTPS', name: 'WASM Worker Mirror Endpoint', target: 'https://pryor.games/worker/v2' }
	];

	private listEl!: HTMLElement;

	constructor()
	{
		super();
		this.initDom();
	}

	protected override onAfterAttach(msg: any): void
	{
		super.onAfterAttach(msg);
		this.renderPaths();
	}

	private initDom(): void
	{
		this.addClass('sub-widget-pane');
		this.node.innerHTML = `
            <div class="paths-settings-container">
                <div class="gh-add-bar">
                    <input type="text" id="pathNameInput" placeholder="Label (e.g., Google Drive / HTTPS Server)" class="config-input" />
                    <input type="text" id="pathTargetInput" placeholder="Path or URL (e.g., https://...)" class="config-input" />
                    <button id="pathAddBtn" class="config-btn primary"><i class="bx bx-plus"></i> Add Path</button>
                </div>
                <div class="paths-list" id="pathsList">
                    <!-- Populated dynamically -->
                </div>
            </div>
        `;

		this.listEl = this.node.querySelector('#pathsList') as HTMLElement;
		this.node.querySelector('#pathAddBtn')?.addEventListener('click', () => this.addPath());
	}

	private renderPaths(): void
	{
		this.listEl.innerHTML = '';
		this.paths.forEach(p =>
		{
			const card = document.createElement('div');
			card.className = 'path-card';
			card.innerHTML = `
                <div class="path-info">
                    <span class="path-badge ${p.type.toLowerCase()}">${p.type}</span>
                    <div class="path-texts">
                        <span class="path-name">${p.name}</span>
                        <code class="path-target">${p.target}</code>
                    </div>
                </div>
                <button class="gh-remove-btn" data-id="${p.id}"><i class="bx bx-trash"></i></button>
            `;

			card.querySelector('.gh-remove-btn')?.addEventListener('click', () =>
			{
				this.paths = this.paths.filter(x => x.id !== p.id);
				this.renderPaths();
			});

			this.listEl.appendChild(card);
		});
	}

	private addPath(): void
	{
		const nameInput = this.node.querySelector('#pathNameInput') as HTMLInputElement;
		const targetInput = this.node.querySelector('#pathTargetInput') as HTMLInputElement;
		const name = nameInput.value.trim();
		const target = targetInput.value.trim();

		if(!name || !target) return;

		this.paths.push({
			id: Math.random().toString(36).substring(2, 9),
			type: target.startsWith('https') ? 'HTTPS' : 'Drive',
			name,
			target
		});

		nameInput.value = '';
		targetInput.value = '';
		this.renderPaths();
	}
}
