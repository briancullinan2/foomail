import { SchemaStoreConfig } from '../bundle/local.d';

export const BOOKMARK_STORE_NAME = 'BOOKMARKS_DATA';
export const BOOKMARK_SCHEME: SchemaStoreConfig[] = [
	{
		key: BOOKMARK_STORE_NAME,
		value: {
			item1: 'id',
			item2: [
				{ key: 'title', value: 'title' },
				{ key: 'url', value: 'url' },
				{ key: 'path', value: 'path' },
				{ key: 'parent', value: 'parent' },
				{ key: 'timestamp', value: 'timestamp' },
				{ key: 'icon', value: 'icon' },
				{ key: 'sourceFileId', value: 'sourceFileId' },
				{ key: 'status', value: 'status' },
				{ key: 'misfitReason', value: 'misfitReason' }
			]
		}
	}
];


export interface IBookmarkNode
{
	id: string;
	title: string;
	url?: string;
	path: string; // e.g. "Bookmarks Bar/Dev/Tools"
	parent: string; // e.g. "Bookmarks Bar/Dev/Tools"
	timestamp?: Date;
	icon?: string;
	sourceFileId: string;
	status: 'normal' | 'duplicate' | 'misfit' | 'missing';
	misfitReason?: string;
}

export interface IBookmarkFileSource
{
	id: string;
	fileName: string;
	droppedAt: Date;
	itemCount: number;
}


export type BookmarksDeltaFilter = 'all' | 'duplicate' | 'misfit' | 'missing';


export class BookmarkParserTools
{

	/**
	 * Process individual dropped HTML or JSON bookmark export file
	 */
	public static async processDroppedFile(file: File): Promise<void>
	{
		const content = await file.text();
		const sourceId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;

		let newItems: IBookmarkNode[] = [];

		if(file.name.endsWith('.json') || content.trim().startsWith('{'))
		{
			newItems = this.parseChromeJson(content, sourceId);
		} else
		{
			newItems = this.parseNetscapeHtml(content, sourceId);
		}

		this.fileSources.push({
			id: sourceId,
			fileName: file.name,
			droppedAt: new Date(),
			itemCount: newItems.length
		});

		this.allBookmarks = [...this.allBookmarks, ...newItems];
	}

	/**
	 * Parser for NETSCAPE-Bookmark-file HTML
	 */
	public static parseNetscapeHtml(html: string, sourceId: string): IBookmarkNode[]
	{
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const links = Array.from(doc.querySelectorAll('a'));

		return links.map((a, idx) =>
		{
			// Determine folder path by looking at parents
			let parent = a.parentElement;
			const folders: string[] = [];
			while(parent)
			{
				if(parent.tagName === 'DL')
				{
					const prevHeader = parent.previousElementSibling;
					if(prevHeader && (prevHeader.tagName === 'H3' || prevHeader.tagName === 'H2'))
					{
						folders.unshift(prevHeader.textContent || 'Unsorted');
					}
				}
				parent = parent.parentElement;
			}

			const folderPath = folders.length > 0 ? folders.join('/') : 'Bookmarks Bar';
			const addDateUnix = a.getAttribute('add_date');

			return {
				id: `bm-${sourceId}-${idx}`,
				title: a.textContent || 'Untitled Bookmark',
				url: a.getAttribute('href') || '',
				path: folderPath,
				parent: folderPath.substring(0, folderPath.lastIndexOf('/')),
				timestamp: addDateUnix ? new Date(parseInt(addDateUnix, 10) * 1000) : new Date(),
				icon: a.getAttribute('icon') || undefined,
				sourceFileId: sourceId,
				status: 'normal'
			};
		});
	}

	/**
	 * Parser for Chrome Bookmarks JSON format
	 */
	public static parseChromeJson(jsonStr: string, sourceId: string): IBookmarkNode[]
	{
		const results: IBookmarkNode[] = [];
		try
		{
			const data = JSON.parse(jsonStr);
			const roots = data.roots || { bookmark_bar: data };

			const traverse = (node: any, currentPath: string) =>
			{
				if(node.type === 'url')
				{
					results.push({
						id: `bm-${sourceId}-${results.length}`,
						title: node.name || 'Untitled',
						url: node.url,
						path: currentPath,
						parent: currentPath.substring(0, currentPath.lastIndexOf('/')),
						timestamp: node.date_added ? new Date(parseInt(node.date_added, 10) / 1000) : new Date(),
						sourceFileId: sourceId,
						status: 'normal'
					});
				} else if(node.children)
				{
					const nextPath = currentPath ? `${currentPath}/${node.name}` : node.name || 'Bookmarks Bar';
					node.children.forEach((child: any) => traverse(child, nextPath));
				}
			};

			Object.keys(roots).forEach((key) => traverse(roots[key], key));
		} catch(e)
		{
			console.error('Failed parsing Chrome JSON Bookmarks', e);
		}
		return results;
	}

}
