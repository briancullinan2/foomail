import { Widget } from "@lumino/widgets";
import type { IBookmarkNode, BookmarksDeltaFilter, IBookmarkFileSource } from "./widget-parsers";
import { Signal } from '@lumino/signaling';



export class BookmarksListWidget extends Widget
{
	public readonly exportTriggered = new Signal<this, string>(this);
	public readonly layoutChanged = new Signal<this, string[]>(this);

	private targetFolderTree: string[] = ['Bookmarks Bar', 'Bookmarks Bar/Dev', 'Other Bookmarks'];
	private fileSources: IBookmarkFileSource[] = [];
	private activeFilter: BookmarksDeltaFilter = 'all';
	private allBookmarks: IBookmarkNode[] = [];

	constructor(title?: string)
	{
		super();
		this.id = 'lumino-bookmark-list';
		this.title.label = title ?? "Bookmarks";
		this.title.iconClass = 'bx bx-bookmarks';
		this.title.closable = true;
		this.title.className = this.id;
		this.addClass('bm-manager-list');
		this.renderLayout();
	}


	private renderLayout()
	{
		this.node.innerHTML = '';
		this.node.appendChild(this.createControlPanel());
	}


	/**
	 * Export Merged Bookmarks back into standard Netscape HTML format
	 */
	private handleExportHTML(): void
	{
		let htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Bar</H1>
<DL><p>\n`;

		this.allBookmarks.forEach((b) =>
		{
			const dateUnix = b.addDate ? Math.floor(b.addDate.getTime() / 1000) : '';
			htmlContent += `    <DT><A HREF="${b.url}" ADD_DATE="${dateUnix}">${this.escapeHtml(b.title)}</A>\n`;
		});

		htmlContent += `</DL><p>\n`;

		// Download file trigger
		const blob = new Blob([htmlContent], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `merged_bookmarks_${Date.now()}.html`;
		a.click();
		URL.revokeObjectURL(url);

		this.exportTriggered.emit(htmlContent);
	}

	/**
	 * Header Toolbar with Quick Stats, PDF Export & Netscape File Export
	 */
	private createTopToolbar(): HTMLElement
	{
		const toolbar = document.createElement('div');
		toolbar.className = 'bm-toolbar';

		const actions = document.createElement('div');
		actions.className = 'bm-toolbar-actions';

		// Export Netscape HTML File
		const btnExport = document.createElement('button');
		btnExport.className = 'bm-btn bm-btn-primary';
		btnExport.innerHTML = `<i class="bx bx-arrow-in-up-square-half"></i> Export Merged`;
		btnExport.onclick = () => this.handleExportHTML();

		// Print / Save to PDF
		const btnPdf = document.createElement('button');
		btnPdf.className = 'bm-btn bm-btn-secondary';
		btnPdf.innerHTML = `📄 Save as PDF`;
		btnPdf.onclick = () => window.print();

		// View Toggle Buttons (Cards vs Grid)
		// const btnCards = document.createElement('button');
		// btnCards.className = `bm-btn bm-btn-icon ${this.viewMode === 'cards' ? 'active' : ''}`;
		// btnCards.innerText = '🔲 Grid';
		// btnCards.onclick = () => { this.viewMode = 'cards'; this.renderLayout(); };

		// const btnGrid = document.createElement('button');
		// btnGrid.className = `bm-btn bm-btn-icon ${this.viewMode === 'grid' ? 'active' : ''}`;
		// btnGrid.innerText = '☰ List';
		// btnGrid.onclick = () => { this.viewMode = 'grid'; this.renderLayout(); };

		actions.appendChild(btnPdf);
		actions.appendChild(btnExport);
		// actions.appendChild(btnCards);
		// actions.appendChild(btnGrid);

		toolbar.appendChild(actions);

		return toolbar;
	}

	/**
	 * Left Control Sidebar: Multi-file Dropzone, Schema JSON Textbox, Diff Filter Controls
	 */
	private createControlPanel(): HTMLElement
	{
		const panel = document.createElement('div');
		panel.className = 'bm-sidebar';

		// 1. File Drop Zone
		const dropzone = document.createElement('div');
		dropzone.className = 'bm-dropzone';
		dropzone.id = 'bm-dropzone-target';
		dropzone.innerHTML = `
		  <div class="bm-dropzone-icon">📁</div>
		  <div class="bm-dropzone-text"><strong>Drag & Drop HTML / Chrome JSON Bookmarks</strong></div>
		  <div class="bm-dropzone-sub">Drop multiple files to calculate temporal merges & diffs</div>
		`;

		// 2. Dropped Files Timeline List
		const fileListSection = document.createElement('div');
		fileListSection.className = 'bm-sidebar-section';
		fileListSection.innerHTML = `<div class="bm-section-title">Files Tracked (${this.fileSources.length})</div>`;
		const fileUl = document.createElement('ul');
		fileUl.className = 'bm-file-list';

		this.fileSources.forEach((src) =>
		{
			const li = document.createElement('li');
			li.className = 'bm-file-item';
			li.innerHTML = `
			<span class="bm-file-name">${src.fileName}</span>
			<span class="bm-file-badge">${src.itemCount} items</span>
		  `;
			fileUl.appendChild(li);
		});
		fileListSection.appendChild(fileUl);

		// 3. Schema JSON Target Textbox
		const schemaSection = document.createElement('div');
		schemaSection.className = 'bm-sidebar-section';
		schemaSection.innerHTML = `
		  <div class="bm-section-title">Target Folder Tree (JSON)</div>
		  <div class="bm-section-sub">All bookmarks will attempt to match these folder paths:</div>
		`;

		const schemaInput = document.createElement('textarea');
		schemaInput.className = 'bm-schema-textarea';
		schemaInput.value = JSON.stringify(this.targetFolderTree, null, 2);
		schemaInput.onchange = () =>
		{
			try
			{
				this.targetFolderTree = JSON.parse(schemaInput.value);
				this.layoutChanged.emit(this.targetFolderTree);
				this.renderLayout();
			} catch(err)
			{
				alert('Invalid JSON folder structure provided.');
			}
		};

		schemaSection.appendChild(schemaInput);

		// 4. Status Legend / Filter Buttons
		const filterSection = document.createElement('div');
		filterSection.className = 'bm-sidebar-section';
		filterSection.innerHTML = `<div class="bm-section-title">Filter Diff Statuses</div>`;

		const filterGroup = document.createElement('div');
		filterGroup.className = 'bm-filter-group';

		const filters: Array<{ label: string; key: BookmarksDeltaFilter; cssClass: string; }> = [
			{ label: 'All Items', key: 'all', cssClass: 'filter-all' },
			{ label: 'Duplicates', key: 'duplicate', cssClass: 'filter-dupe' },
			{ label: 'Misfits', key: 'misfit', cssClass: 'filter-misfit' },
			{ label: 'Missing Tree', key: 'missing', cssClass: 'filter-missing' }
		];

		filters.forEach((f) =>
		{
			const btn = document.createElement('button');
			btn.className = `bm-filter-btn ${f.cssClass} ${this.activeFilter === f.key ? 'selected' : ''}`;
			btn.innerText = f.label;
			btn.onclick = () =>
			{
				this.activeFilter = f.key;
				this.renderLayout();
			};
			filterGroup.appendChild(btn);
		});

		filterSection.appendChild(filterGroup);

		// Top Action Toolbar
		panel.appendChild(this.createTopToolbar());
		panel.appendChild(dropzone);
		panel.appendChild(fileListSection);
		panel.appendChild(schemaSection);
		panel.appendChild(filterSection);

		return panel;
	}


	private escapeHtml(str: string): string
	{
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
}
