import { Widget } from "@lumino/widgets";

export interface IGithubRepo
{
	id: string;
	fullName: string;
	recentCommit: string;
	websiteUrl: string;
	stars: number;
}

export class GithubSettings extends Widget
{
	private repos: IGithubRepo[] = [
		{ id: '1', fullName: 'briancullinan/lumino-workspace', recentCommit: 'Fix WebAssembly worker memory leak bounds', websiteUrl: 'https://pryor.games', stars: 42 },
		{ id: '2', fullName: 'ajaxorg/ace', recentCommit: 'Add WebGPU tensor acceleration support for syntax tokens', websiteUrl: 'https://ace.c9.io', stars: 21500 }
	];

	private repoListEl!: HTMLElement;

	constructor()
	{
		super();
		this.initDom();
	}

	protected override onAfterAttach(msg: any): void
	{
		super.onAfterAttach(msg);
		this.renderRepos();
	}

	private initDom(): void
	{
		this.addClass('sub-widget-pane');
		this.node.innerHTML = `
            <div class="github-settings-container">
                <div class="gh-add-bar">
                    <input type="text" id="ghRepoInput" placeholder="Enter GitHub repo (e.g., owner/repository)" class="config-input" />
                    <button id="ghAddBtn" class="config-btn primary"><i class="bx bx-plus"></i> Add Repository</button>
                </div>
                <div class="gh-repo-list" id="ghRepoList">
                    <!-- Populated dynamically -->
                </div>
            </div>
        `;

		this.repoListEl = this.node.querySelector('#ghRepoList') as HTMLElement;
		this.node.querySelector('#ghAddBtn')?.addEventListener('click', () => this.addRepository());
	}

	private renderRepos(): void
	{
		this.repoListEl.innerHTML = '';
		this.repos.forEach(r =>
		{
			const card = document.createElement('div');
			card.className = 'gh-repo-card';
			card.innerHTML = `
                <div class="gh-repo-info">
                    <div class="gh-repo-title-row">
                        <i class="bx bxl-github"></i>
                        <span class="gh-repo-name">${r.fullName}</span>
                        <a href="${r.websiteUrl}" target="_blank" class="gh-repo-link" title="Visit Website"><i class="bx bx-link-external"></i></a>
                    </div>
                    <span class="gh-commit-msg"><i class="bx bx-git-commit"></i> ${r.recentCommit}</span>
                </div>
                <div class="gh-repo-stats">
                    <span class="gh-star-badge"><i class="bx bx-star"></i> ${r.stars}</span>
                    <button class="gh-remove-btn" data-id="${r.id}" title="Remove Repo"><i class="bx bx-trash"></i></button>
                </div>
            `;

			card.querySelector('.gh-remove-btn')?.addEventListener('click', () =>
			{
				this.repos = this.repos.filter(repo => repo.id !== r.id);
				this.renderRepos();
			});

			this.repoListEl.appendChild(card);
		});
	}

	private addRepository(): void
	{
		const input = this.node.querySelector('#ghRepoInput') as HTMLInputElement;
		const val = input.value.trim();
		if(!val) return;

		const newRepo: IGithubRepo = {
			id: Math.random().toString(36).substring(2, 9),
			fullName: val,
			recentCommit: 'Initial workspace hook synchronization',
			websiteUrl: `https://github.com/${val}`,
			stars: Math.floor(Math.random() * 100)
		};

		this.repos.push(newRepo);
		input.value = '';
		this.renderRepos();
	}
}
