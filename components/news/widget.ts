import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { WidgetExtensionsWindow } from "../bundle/widget-extensions";

export interface IFeedChannel
{
	id: string;
	title: string;
	category: string;
	description: string;
	feedUrl: string;
	siteUrl: string;
	thumbnail: string;
	unreadCount: number;
	isSubscribed: boolean;
}

export interface IFeedItem
{
	id: string;
	channelTitle: string;
	title: string;
	snippet: string;
	date: string;
	author?: string;
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& WidgetExtensionsWindow = self as unknown as any;

export class NewsWidget extends widgetSelf.GenericSearchableWidget
{
	private channels: IFeedChannel[] = [];
	private samplePreviewItem: IFeedItem | null = null;
	private urlInput!: HTMLInputElement;
	private previewModalEl!: HTMLElement;
	private railsContainerEl!: HTMLElement;

	private _subscriptionChanged: Signal<NewsWidget, IFeedChannel[]> = new Signal(this);
	public get subscriptionChanged(): ISignal<NewsWidget, IFeedChannel[]> { return this._subscriptionChanged; }

	constructor()
	{
		super();
		this.title.label = 'Feed Stream & Subscriptions';
		this.title.iconClass = 'bx bx-tv';
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
		this.channels = [
			{
				id: 'ch-1',
				title: 'Linux Kernel Mailing List (LKML)',
				category: 'Public Maildirs & Core Systems',
				description: 'High-frequency discussions on scheduler tuning, memory management, and hardware drivers.',
				feedUrl: 'https://lore.kernel.org/lkml/new.atom',
				siteUrl: 'https://lore.kernel.org/lkml/',
				thumbnail: '🖥️',
				unreadCount: 14,
				isSubscribed: true
			},
			{
				id: 'ch-2',
				title: 'Hacker News: Frontpage RSS',
				category: 'Tech & Engineering',
				description: 'Top community-submitted discussions on computer science, start-ups, and runtimes.',
				feedUrl: 'https://news.ycombinator.com/rss',
				siteUrl: 'https://news.ycombinator.com',
				thumbnail: '🍊',
				unreadCount: 8,
				isSubscribed: true
			},
			{
				id: 'ch-3',
				title: 'Anthropic Research & Engineering',
				category: 'AI & Local Models',
				description: 'Deep dives into constitutional AI, agent tool use, and WebGPU tensor acceleration.',
				feedUrl: 'https://www.anthropic.com/news/rss.xml',
				siteUrl: 'https://www.anthropic.com/news',
				thumbnail: '🤖',
				unreadCount: 3,
				isSubscribed: true
			},
			{
				id: 'ch-4',
				title: 'WebKit Open Source Dispatch',
				category: 'Browsers & Runtimes',
				description: 'WebAssembly engine performance benchmarks, garbage collection, and rendering pipelines.',
				feedUrl: 'https://webkit.org/feed/',
				siteUrl: 'https://webkit.org',
				thumbnail: '🧭',
				unreadCount: 0,
				isSubscribed: false
			}
		];
	}

	private initDom(): void
	{
		this.addClass('nf-subscriber-root');
		this.node.innerHTML = `
            <div class="nf-hero-banner">
                <div class="nf-hero-content">
                    <span class="nf-badge-live"><i class="bx bx-radio-circle-marked"></i> Live Feed Stream</span>
                    <h1>Discover & Subscribe</h1>
                    <p>Paste any website bookmark or RSS/Atom feed URL below. Our auto-discovery engine scans the page header and generates a live sample pull for your inbox.</p>

                    <div class="nf-subscribe-bar">
                        <i class="bx bx-globe"></i>
                        <input type="text" id="nfUrlInput" placeholder="Paste website URL or RSS/Atom feed link (e.g., https://lwn.net/headlines/rss)" />
                        <button id="nfDiscoverBtn" class="nf-btn-primary">
                            <i class="bx bx-search-alt"></i> Inspect & Preview
                        </button>
                    </div>
                </div>
            </div>

            <div class="nf-rails-container" id="nfRailsContainer">
                <!-- Rendered category rails dynamically -->
            </div>

            <!-- Sample Inbox Drop Preview Modal Overlay -->
            <div class="nf-modal-overlay" id="nfPreviewModal" style="display:none;">
                <div class="nf-modal-card">
                    <div class="nf-modal-header">
                        <div class="nf-modal-title-wrap">
                            <i class="bx bx-import"></i>
                            <div>
                                <h3>Sample Inbox Drop Preview</h3>
                                <span id="nfModalChannelName" class="nf-sub-title">Channel Name</span>
                            </div>
                        </div>
                        <button class="nf-close-modal" id="nfCloseModal"><i class="bx bx-x"></i></button>
                    </div>
                    <div class="nf-modal-body" id="nfModalPreviewContent">
                        <!-- Preview card resembling inbox transmission -->
                    </div>
                    <div class="nf-modal-footer">
                        <button class="nf-btn-secondary" id="nfCancelModalBtn">Discard</button>
                        <button class="nf-btn-primary" id="nfConfirmSubscribeBtn"><i class="bx bx-plus"></i> Confirm & Subscribe</button>
                    </div>
                </div>
            </div>
        `;

		this.urlInput = this.node.querySelector('#nfUrlInput') as HTMLInputElement;
		this.previewModalEl = this.node.querySelector('#nfPreviewModal') as HTMLElement;
		this.railsContainerEl = this.node.querySelector('#nfRailsContainer') as HTMLElement;

		this.node.querySelector('#nfDiscoverBtn')?.addEventListener('click', () => this.handleDiscoverUrl());
		this.urlInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') this.handleDiscoverUrl(); });

		this.node.querySelector('#nfCloseModal')?.addEventListener('click', () => this.hidePreviewModal());
		this.node.querySelector('#nfCancelModalBtn')?.addEventListener('click', () => this.hidePreviewModal());
		this.node.querySelector('#nfConfirmSubscribeBtn')?.addEventListener('click', () => this.confirmSubscription());
	}

	private renderAll(): void
	{
		this.railsContainerEl.innerHTML = '';

		// Group channels by category
		const categories = Array.from(new Set(this.channels.map(c => c.category)));

		categories.forEach(cat =>
		{
			const catChannels = this.channels.filter(c => c.category === cat);
			const railSection = document.createElement('div');
			railSection.className = 'nf-rail-section';

			railSection.innerHTML = `
                <h2>${this.escapeHTML(cat)}</h2>
                <div class="nf-rail-track">
                    ${catChannels.map(ch => `
                        <div class="nf-channel-card ${ch.isSubscribed ? 'subscribed' : ''}" data-id="${ch.id}">
                            <div class="nf-card-thumb">${ch.thumbnail}</div>
                            <div class="nf-card-info">
                                <span class="nf-ch-title">${this.escapeHTML(ch.title)}</span>
                                <span class="nf-ch-desc">${this.escapeHTML(ch.description)}</span>
                            </div>
                            <div class="nf-card-actions">
                                <button class="nf-action-btn toggle-sub" data-id="${ch.id}">
                                    ${ch.isSubscribed ? '<i class="bx bx-check"></i> Subscribed' : '<i class="bx bx-plus"></i> Subscribe'}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

			// Bind subscribe toggle buttons
			railSection.querySelectorAll('.toggle-sub').forEach(btn =>
			{
				btn.addEventListener('click', (e) =>
				{
					e.stopPropagation();
					const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
					const channel = this.channels.find(c => c.id === id);
					if(channel)
					{
						channel.isSubscribed = !channel.isSubscribed;
						this.renderAll();
						this._subscriptionChanged.emit(this.channels);
					}
				});
			});

			this.railsContainerEl.appendChild(railSection);
		});
	}

	private async handleDiscoverUrl(): Promise<void>
	{
		const url = this.urlInput.value.trim();
		if(!url)
		{
			alert('Please enter a valid website URL or RSS feed link.');
			return;
		}

		// Simulate header inspection / RSS auto-discovery
		// In browser environments without CORS proxies, we emulate the discovery handshake
		setTimeout(() =>
		{
			this.samplePreviewItem = {
				id: 'sample-' + Math.random().toString(36).substring(2, 9),
				channelTitle: url.replace('https://', '').split('/')[0].toUpperCase(),
				title: `[Dispatched Update] Latest transmission parsed from ${url}`,
				snippet: `Successfully traversed header tags, discovered application/rss+xml feed endpoint, and parsed recent broadcast payload...`,
				date: 'Just now',
				author: 'Automated Feed Parser'
			};

			this.showPreviewModal(url);
		}, 300);
	}

	private showPreviewModal(targetUrl: string): void
	{
		(this.node.querySelector('#nfModalChannelName') as HTMLElement).textContent = targetUrl;
		const previewContainer = this.node.querySelector('#nfModalPreviewContent') as HTMLElement;

		if(this.samplePreviewItem)
		{
			previewContainer.innerHTML = `
                <div class="em-message-card unread selected">
                    <div class="em-avatar">RSS</div>
                    <div class="em-message-preview">
                        <div class="em-preview-top">
                            <span class="em-sender">${this.escapeHTML(this.samplePreviewItem.channelTitle)}</span>
                            <span class="em-time">${this.samplePreviewItem.date}</span>
                        </div>
                        <span class="em-subject">${this.escapeHTML(this.samplePreviewItem.title)}</span>
                        <span class="em-snippet">${this.escapeHTML(this.samplePreviewItem.snippet)}</span>
                        <div class="em-ai-tag-row">
                            <span class="em-ai-badge newsletter">Live Feed Preview</span>
                        </div>
                    </div>
                </div>
            `;
		}

		this.previewModalEl.style.display = 'flex';
	}

	private hidePreviewModal(): void
	{
		this.previewModalEl.style.display = 'none';
	}

	private confirmSubscription(): void
	{
		const url = this.urlInput.value.trim();
		const newChannel: IFeedChannel = {
			id: 'ch-' + Math.random().toString(36).substring(2, 9),
			title: url.replace('https://', '').split('/')[0],
			category: 'Custom Subscriptions',
			description: `Discovered feed stream from ${url}`,
			feedUrl: url,
			siteUrl: url,
			thumbnail: '📡',
			unreadCount: 1,
			isSubscribed: true
		};

		this.channels.push(newChannel);
		this.renderAll();
		this._subscriptionChanged.emit(this.channels);
		this.hidePreviewModal();
		this.urlInput.value = '';
	}

}
