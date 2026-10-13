// menu.ts
import { Menu, MenuBar, DockPanel, Panel, Widget } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';
import { RepositoryToolbar } from './menu-repos';
import { ScriptToolbar } from './menu-script';
import { ApplicationToolbar } from './menu-app';
import { FileToolbar } from './menu-file';
import { SettingsToolbar } from './menu-settings';
import { HistoryToolbar } from './menu-history';
import { LayoutAdjuster } from './lumino-widget';
import { loadAndInstantiate } from './babel-compile';
import { OUTLINE_WIDGET_TYPES, updateModifierPressed } from './lumino-resize';
import { FileManager } from './lumino-files';
import type { GlobalToolbarsWindow, LuminoMenuWindow, RepositorySettingsWindow } from './menu.d';
import type { LuminoLayoutWindow } from './lumino.d';
import type { EditorWindow } from '../editor/widget.d';
import { EditToolbar } from './menu-edit';
import { ViewToolbar } from './menu-view';
import { LayoutToolbar } from './menu-layout';


const menuSelf: RepositorySettingsWindow & LuminoMenuWindow & LuminoLayoutWindow & GlobalToolbarsWindow & EditorWindow = self as unknown as any;


export interface TopBarComponents
{
	headerRow: Panel;
	menuBar: MenuBar;
}


export interface TerminalFilter
{
	id: string;
	label: string;
}



export interface ComponentRoute
{
	key?: string;
	label: string;
	url?: string;
	className?: string;
	iconClass: string; // The specific Boxicons layout string tokens
	description?: string;
	subtext?: string;
}

// 1. Unified metadata tree tracking every panel type and icon token

export const MODULE_REGISTRY: Record<string, ComponentRoute> = {
	'collapse': {
		label: 'Collapse',
		iconClass: 'bx bx-arrow-in-left-square-half',
		subtext: 'Requires Lumino DockPanel container references and UI state layout persistence.',
		description: 'Collapses active sidebars or secondary workspace panels to maximize primary viewing space across media and storage widgets.'
	},
	'email': {
		label: 'My Email',
		url: './components/email/widget.ts',
		className: 'EmailWidget',
		iconClass: 'bx bx-envelope',
		subtext: 'Depends on IMAP/SMTP transport layers, HTML DOM sanitizers, and thread-grouping parser modules.',
		description: 'A full-featured webmail interface providing inbox synchronization, rich-text drafting, message searching, and attachment preview capabilities.'
	},
	'calendar': {
		label: 'Schedule/Calendar',
		url: './components/calendar/widget.ts',
		className: 'CalendarWidget',
		iconClass: 'bx bx-calendar-alt',
		subtext: 'Depends on iCal/rrule parsing algorithms, timezone offset resolvers, and drag-and-drop event dispatcher utilities.',
		description: 'An interactive multi-view calendar widget for scheduling events, managing recurring appointments, and tracking timeline deadlines.'
	},
	'contacts': {
		label: 'Contacts List',
		url: './components/contacts/widget.ts',
		className: 'ContactsWidget',
		iconClass: 'bx bx-group',
		subtext: 'Depends on vCard serialization drivers, fuzzy-search string matching, and indexed contact storage schema.',
		description: 'A centralized address book interface for organizing contacts, managing communication metadata, and exporting vCard profiles.'
	},
	'tasks': {
		label: 'Tasks List',
		url: './components/tasks/widget.ts',
		className: 'TasksWidget',
		iconClass: 'bx bx-task',
		subtext: 'Depends on state state-machine transitions, local priority sorting heuristics, and task dependency graph resolvers.',
		description: 'A task and to-do list manager supporting task categorization, priority tags, completion tracking, and sub-task nesting.'
	},
	'notes': {
		label: 'Notes/Journal',
		url: './components/notes/widget.ts',
		className: 'NotesWidget',
		iconClass: 'bx bx-note-book',
		subtext: 'Depends on Markdown/WYSIWYG AST parsers, local storage persistence hooks, and document tree models.',
		description: 'A personal notebook and journaling workspace supporting rich text formatting, tag indexing, and instant autosave drafts.'
	},
	'searchlist': {
		label: 'Search Files',
		url: './components/filelist/widget-search.ts',
		className: 'SearchListWidget',
		iconClass: 'bx bx-search',
		subtext: 'Depends on indexed search database endpoints, debounced input triggers, and query-parsing regex modules.',
		description: 'An indexed filesystem search interface that queries local and remote metadata to rapidly retrieve shared media files, audio tracks, and archives.'
	},
	'tools': {
		label: 'More Tools',
		url: './components/tools/widget.ts',
		className: 'ToolsWidget',
		iconClass: 'bx bx-spanner',
		subtext: 'Integrates PK3/ZIP extraction pipelines, package resolution managers, SOCKS5/UDP proxy tunnels, and WASM/Emscripten runners.',
		description: 'A multi-tool drawer housing automated asset mirrors, package managers, proxy tunnel configurations, and engine diagnostic utilities.'
	},
};


menuSelf.MODULE_REGISTRY = MODULE_REGISTRY;

export const TOOLS_REGISTRY: Record<string, ComponentRoute> = {
	'servers': {
		label: 'Server Settings',
		url: './components/email/widget-servers.ts',
		className: 'ServerSettingsWidget',
		iconClass: 'bx bx-server',
		subtext: 'Depends on IMAP/SMTP/POP3 protocol configuration stores, secure credential vault, and connection health ping loops.',
		description: 'A server configuration panel for managing remote mail servers, configuring incoming/outgoing host endpoints, testing port connectivity, and handling authentication credentials.'
	},
	'keystore': {
		label: 'Keystore Manager',
		url: './components/keystore/widget.ts',
		className: 'KeystoreWidget',
		iconClass: 'bx bx-key',
		subtext: 'Depends on IndexedDB encrypted blob stores, WebCrypto subtle encryption APIs, PIN verification overlays, and credential form-autofill parsers.',
		description: 'A secure vault manager providing PIN-protected credential storage, customizable form-field autofill mapping, drag-and-drop file ingestion (CSV, JSON, HTML, API keys), and encrypted export backups.'
	},
	'folders': {
		label: 'Watched Folders',
		url: './components/assets/widget-settings.ts',
		className: 'FolderWizardWidget',
		iconClass: 'bx bx-folder-check',
		subtext: 'Powered by cross-platform OS special path presets, File System Access API directory pickers, and middleware watcher synchronization.',
		description: 'An interactive configuration wizard to manage virtual database folder mappings, monitor local storage availability, and sync directories with backend watchers.'
	},
	'groups': {
		label: 'Groups Manager',
		url: './components/groups/widget.ts',
		className: 'GroupsWidget',
		iconClass: 'bx bx-community',
		subtext: 'Depends on role-based access control (RBAC) handlers, user relationship trees, and directory sync endpoints.',
		description: 'A management panel for organizing user memberships, configuring team permissions, and establishing shared resource access policies.'
	},
	'news': {
		label: 'News Subscriptions',
		url: './components/news/widget.ts',
		className: 'NewsWidget',
		iconClass: 'bx bx-newspaper',
		subtext: 'Depends on RSS/Atom XML feed parsers, image caching proxies, and article summary extraction modules.',
		description: 'A customizable RSS/Atom feed reader for aggregating external news feeds, article updates, and content channels in real time.'
	},
	'chat': {
		label: 'Chat Agent',
		url: './components/chat/widget.ts',
		className: 'ChatWidget',
		iconClass: 'bx bx-discussion',
		subtext: 'Depends on WebSocket real-time event sockets, active user presence monitors, and message stream buffer managers.',
		description: 'A real-time messaging panel for instant multi-user communication, channel discussions, direct messaging, and media sharing.'
	},
	'campaign': {
		label: 'Campaign Builder',
		url: './components/email/widget-campaign.ts',
		className: 'CampaignWidget',
		iconClass: 'bx bx-paper-plane',
		subtext: 'Depends on LightGraph visual node layout engine, drip triggers, A/B split routing, and web-hook automation pipelines.',
		description: 'An enterprise marketing automation builder (similar to Eloqua or Oracle Responsys) using a visual workflow graph to orchestrate drip campaigns, dynamic segmentation, and event-driven email journeys.'
	},
	'signature': {
		label: 'Signature Editor',
		url: './components/email/widget-signature.ts',
		className: 'SignatureWidget',
		iconClass: 'bx bx-pen',
		subtext: 'Depends on inline CSS inliners, HTML DOM sanitizers, dynamic LDAP/vCard token injectors, and rich canvas previews.',
		description: 'A WYSIWYG email signature manager for creating cross-client HTML signatures, social icon badges, and corporate disclaimers with placeholder variables.'
	},
	'source': {
		label: 'Source Inspector',
		url: './components/editor/widget-source.ts',
		className: 'SourceInspectorWidget',
		iconClass: 'bx bx-code-alt',
		subtext: 'Depends on Ace9 editor instance bindings, raw MIME/RFC-822 header decoders, and syntax highlighting AST lexers.',
		description: 'An raw code inspector powered by the Ace9 editor for analyzing raw email headers, validating HTML/CSS markup, debugging MIME parts, and editing template source directly.'
	},
	'backup': {
		label: 'Email Backup',
		url: './components/email/widget-backup.ts',
		className: 'EmailBackupWidget',
		iconClass: 'bx bx-hard-drive',
		subtext: 'Depends on MBOX/EML binary serializers, incremental compression streams (gzip/tar), and IndexedDB blob persistence.',
		description: 'A local archival utility for generating compressed MBOX/EML backups of local and remote mailboxes, folder structures, and attachments.'
	},
	'recovery': {
		label: 'Email Recovery',
		url: './components/email/widget-recovery.ts',
		className: 'EmailRecoveryWidget',
		iconClass: 'bx bx-history',
		subtext: 'Depends on file stream readers, orphan block reconstruction, corrupted header repair modules, and state rollback diffing.',
		description: 'A disaster recovery utility for restoring archived mail archives, parsing damaged `.eml` files, and re-indexing lost folder trees back into the client storage.'
	},
	'trash': {
		label: 'Deleted Items',
		url: './components/email/widget-trash.ts',
		className: 'EmailTrashWidget',
		iconClass: 'bx bx-trash',
		subtext: 'Depends on soft-delete retention schedules, batch storage cleanup workers, and IMAP EXPUNGE sync handlers.',
		description: 'A dedicated trash manager and storage retention monitor for permanently purging expired messages, recovering accidentally deleted threads, and clearing cached attachments.'
	},
	'pgp': {
		label: 'PGP Encryption',
		url: './components/email/widget-pgp.ts',
		className: 'PGPConfigWidget',
		iconClass: 'bx bx-key',
		subtext: 'Depends on OpenPGP.js WebAssembly crypto bindings, keypair generator routines, WebCrypto APIs, and WKD endpoints.',
		description: 'An end-to-end PGP key manager for generating RSA/ECC key pairs, configuring public key web key directories (WKD), signing outgoing mail, and encrypting internal message stores.'
	},
	'profile': {
		label: 'Public Directory',
		url: './components/email/widget-public-directory.ts',
		className: 'PublicDirectoryWidget',
		iconClass: 'bx bx-user-id-card',
		subtext: 'Depends on public key broadcasting protocol adapters, user profile schemas, and decentralized key lookup servers.',
		description: 'A public broadcast server directory and user profile page viewer for hosting user public keys, verified signatures, avatar metadata, and security certificates.'
	},
	'users': {
		label: 'User Profiles',
		url: './components/email/widget-users.ts',
		className: 'UserProfilesWidget',
		iconClass: 'bx bx-card-view-tiles',
		subtext: 'Depends on local storage identity stores, multi-account IMAP/OAuth token managers, and state switching listeners.',
		description: 'A local profile manager for organizing multiple user identities, switching SMTP senders, managing local credentials, and scoping individual mailbox databases.'
	},
	'templates': {
		label: 'Template Library',
		url: './components/email/widget-templates.ts',
		className: 'TemplateLibraryWidget',
		iconClass: 'bx bx-layout',
		subtext: 'Depends on Liquid/Handlebars string interpolation engines, responsive layout preview frames, and snippet asset registries.',
		description: 'A repository for managing reusable HTML email templates, dynamic layout blocks, responsive email frames, and automated transactional message patterns.'
	},
	'analytics': {
		label: 'Email Analytics',
		url: './components/email/widget-analytics.ts',
		className: 'EmailAnalyticsWidget',
		iconClass: 'bx bx-chart-trend',
		subtext: 'Depends on tracking pixel log aggregators, link click counter endpoints, and client-side Chart.js renderers.',
		description: 'A dashboard tracking email deliverability rates, open/click metrics, unsubscribe counters, and visual campaign performance statistics.'
	},
	'spam': {
		label: 'Spam Filter',
		url: './components/email/widget-spam.ts',
		className: 'SpamGuardWidget',
		iconClass: 'bx bx-shield-quarter',
		subtext: 'Depends on SpamAssassin heuristic rulesets, Naive Bayes classifier workers, and DKIM/SPF/DMARC DNS record validators.',
		description: 'A security guard that checks incoming message headers against SPF/DKIM validation rules, executes client-side spam heuristics, and manages blocklists.'
	},
	'filelist': {
		label: 'Engine Files',
		url: './components/filelist/widget.ts',
		className: 'FileListWidget',
		iconClass: 'bx bx-folder-code',
		subtext: 'Depends on File System Access API handles, virtual file tree nodes, and binary stream read/write pipelines.',
		description: 'A comprehensive file manager widget for browsing local or remote project workspaces, inspecting file trees, and performing file operations.'
	},
	'settings': {
		label: 'Edit Settings',
		url: './components/settings/widget.ts',
		className: 'SettingsWidget',
		iconClass: 'bx bx-gear',
		subtext: 'Depends on schema validation transformers, JSON configuration stores, and reactive theme/preference listeners.',
		description: 'A configuration panel allowing users to customize UI theme preferences, keybindings, network endpoints, and system parameters.'
	},
	'terminal-container': {
		label: 'Show Console',
		url: './components/terminal/widget.ts',
		className: 'TerminalWidget',
		iconClass: 'bx bx-terminal',
		subtext: 'Depends on xterm.js or ANSI escape sequence decoders, Virtual PTY web sockets, and command history buffers.',
		description: 'An embedded terminal emulator interface providing interactive command-line access, execution logs, and PTY session management.'
	},
	'graph': {
		label: 'Workflow Graph',
		url: './components/graph/widget.ts',
		className: 'LightGraphWidget',
		iconClass: 'bx bx-chart-stacked-rows',
		subtext: 'Depends on LightGraph layout engines, HTML5/WebGL node render loops, and serialization graph topologies.',
		description: 'A visual node-based workflow graph editor for wiring execution pipelines, data flow paths, and modular visualizer connections.'
	},
	'bookmarks': {
		label: 'Bookmark Merge',
		url: './components/bookmarks/widget.ts',
		className: 'BookmarksWidget',
		iconClass: 'bx bx-bookmarks',
		subtext: 'Requires multi-file drag-and-drop parsers, Netscape HTML/Chrome JSON decoders, and schema diff algorithms.',
		description: 'Visualizes, diffs, and merges bookmark structures across temporal exports with custom target folder schema matching, PDF generation, and color-coded status tracking.'
	},
};

menuSelf.TOOLS_REGISTRY = TOOLS_REGISTRY;


export const TERMINAL_REGISTRY: TerminalFilter[] = [
	// Log Levels & Diagnostics
	{ id: 'all', label: 'All Logs' },
	{ id: 'error', label: 'Errors' },
	{ id: 'warn', label: 'Warnings' },

	// Core UI & Systems
	{ id: 'soft', label: 'CLI Render' },    // Matches your custom terminal viewport / frame limiter
	{ id: 'build', label: 'Build' },        // Compiler, AST parsers, build chains
	{ id: 'runtime', label: 'Runtime Dev' }, // Main loop, tasks, orchestration

	// Network & Background
	{ id: 'network', label: 'Network' },    // Custom meshes, P2P syncing, OAuth channels
	{ id: 'console', label: 'Console' },    // Standard fallback stdout / logging intercepts
	{ id: 'ai', label: 'AI Integration' }   // Local models, WebGPU memory, inference steps
];


menuSelf.TERMINAL_REGISTRY = TERMINAL_REGISTRY;


export async function triggerPanelRoute(panelId: string, mainDock: DockPanel, noHide: boolean = false): Promise<void>
{
	const route = MODULE_REGISTRY[panelId] ?? TOOLS_REGISTRY[panelId];
	/*TODO: this applied only to file open
	if(panelId === 'viewport-frame')
	{
		const preferredRenderer = SettingsManager.get('toji', 'preferredRenderer');
		if(preferredRenderer === 'nunu')
		{
			route = MODULE_REGISTRY['nunu'];
		}
	}*/
	if(!route || !route.url)
	{
		console.log('Panel route not found: ' + panelId);
		return; // Skip routes without code targets (like collapse)
	}

	try
	{
		// 1. Gather active DOM widgets
		const currentDOMWidgets = Array.from(mainDock.widgets());

		// 2. Identify target instances stored in memory
		let targetMemoryWidgets: Widget[] = [];

		if(route.className === 'TerminalWidget')
		{
			targetMemoryWidgets = menuSelf.terminalWidgets || [];
		} else if(route.className && OUTLINE_WIDGET_TYPES.includes(route.className))
		{
			targetMemoryWidgets = (menuSelf.fileListWidgets || []).filter(
				(w: any) => w.constructor.name === route.className
			);
		}

		// Find if a matching widget is mounted in the DOM dock
		const matchingDOMWidget = currentDOMWidgets.find(
			domWidget => domWidget.constructor.name === route.className
		);

		// 3. Handle toggling and activation
		if(targetMemoryWidgets.length > 0)
		{
			console.log('Panel route already loaded in memory: ' + panelId);

			if(matchingDOMWidget && !noHide)
			{
				// Lumino check: Widget is active on top if it's currently selected in its dock tab area
				// and its root node isn't hidden by display: none
				const selectedWidgets = typeof (mainDock as any).selectedWidgets === 'function'
					? Array.from((mainDock as any).selectedWidgets())
					: [];

				const isTabSelectedOnTop = selectedWidgets.includes(matchingDOMWidget) ||
					(matchingDOMWidget.isVisible && matchingDOMWidget.node.style.display !== 'none');

				if(isTabSelectedOnTop)
				{
					// Already active and visible on top -> Collapse/Hide
					collapseWidgets(mainDock, true, route);
				} else
				{
					// Mounted in DOM, but hidden behind another tab -> Activate & bring to top
					mainDock.activateWidget(matchingDOMWidget);
					if(typeof matchingDOMWidget.activate === 'function')
					{
						matchingDOMWidget.activate();
					}
				}
			} else
			{
				// Exists in memory but completely removed/detached from DOM -> Expand/Restore
				collapseWidgets(mainDock, false, route);

				targetMemoryWidgets.forEach(w =>
				{
					if(typeof w.show === 'function') w.show();
				});

				mainDock.activateWidget(targetMemoryWidgets[0]);
				if(typeof targetMemoryWidgets[0].activate === 'function')
				{
					targetMemoryWidgets[0].activate();
				}
			}
			return;
		}


		if(matchingDOMWidget)
		{
			console.log('Panel route already loaded: ' + panelId);
			matchingDOMWidget.show();
			mainDock.activateWidget(matchingDOMWidget);
			matchingDOMWidget.activate();
			return;
		}


		const widgetInstance = await loadAndInstantiate(route);
		if(widgetInstance.constructor.name === 'TerminalWidget')
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'terminal',
				projectId: widgetInstance.constructor.name
			});
		}
		else if(OUTLINE_WIDGET_TYPES.includes(widgetInstance.constructor.name))
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'outline',
				projectId: widgetInstance.constructor.name
			});
		} else
		{
			LayoutAdjuster.addOptimalWidgetLayout(mainDock, widgetInstance, {
				type: 'editor',
				projectId: widgetInstance.constructor.name
			});
		}

		await new Promise(resolve =>
		{
			window.requestAnimationFrame(resolve);
		});
	} catch(err)
	{
		console.error(`Module initialization fault on pathway [${panelId}]:`, err);
	}
}


menuSelf.triggerPanelRoute = triggerPanelRoute;


function initializeTabsMenu(commands: CommandRegistry, mainDock: DockPanel, viewMenu: Menu)
{

	// 0. setup tabs menu
	commands.addCommand('select-tab', {
		iconClass: 'bx bx-tabs',
		label: (args) =>
		{
			return Array.from(mainDock.widgets()).find(w =>
			{
				return w.id === args.value;
			})?.title.label
				?? (args.label as string) ?? 'Select Tab';
		},
		execute: (args: any) =>
		{
			Array.from(mainDock.widgets()).forEach(w =>
			{
				if(w.id === args.value)
				{
					mainDock.activateWidget(w);
					w.activate();
				}
			});
		}
	});

	commands.addCommand('next-tab', {
		label: 'Next Tab',
		iconClass: 'bx bx-chevron-right-square',
		isEnabled: () =>
		{
			return true;
			// Optional: don't switch tabs if the user is typing in a text field
			//const active = document.activeElement;
			//const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
			//return !isTyping;
		},
		execute: () =>
		{
			if(!menuSelf.lastInteractedWidget)
			{
				return;
			}
			const widgets = Array.from(mainDock.widgets());
			const currentWidgetIndex = widgets.indexOf(menuSelf.lastInteractedWidget);
			if(currentWidgetIndex === widgets.length - 1)
			{
				menuSelf.lastInteractedWidget = widgets[0];
				mainDock.activateWidget(widgets[0]);
				widgets[0].activate();
			} else
			{
				menuSelf.lastInteractedWidget = widgets[currentWidgetIndex + 1];
				mainDock.activateWidget(widgets[currentWidgetIndex + 1]);
				widgets[currentWidgetIndex + 1].activate();
			}
			return false;
		}
	});
	commands.addCommand('previous-tab', {
		label: 'Previous Tab',
		iconClass: 'bx bx-chevron-left-square',
		isEnabled: () =>
		{
			return true;
			//const active = document.activeElement;
			//const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
			//return !isTyping;
		},
		execute: () =>
		{
			if(!menuSelf.lastInteractedWidget)
			{
				return;
			}
			const widgets = Array.from(mainDock.widgets());
			const currentWidgetIndex = widgets.indexOf(menuSelf.lastInteractedWidget);
			if(currentWidgetIndex === 0)
			{
				menuSelf.lastInteractedWidget = widgets[widgets.length - 1];
				mainDock.activateWidget(widgets[widgets.length - 1]);
				widgets[widgets.length - 1].activate();
			} else
			{
				menuSelf.lastInteractedWidget = widgets[currentWidgetIndex - 1];
				mainDock.activateWidget(widgets[currentWidgetIndex - 1]);
				widgets[currentWidgetIndex - 1].activate();
			}
		}
	});

	commands.addKeyBinding({
		command: 'previous-tab',
		keys: ['Alt N'],
		selector: '*'
	});
	commands.addKeyBinding({
		command: 'next-tab',
		keys: ['Alt M'],
		selector: '*'
	});

	const tabsMenu = new Menu({ commands });
	tabsMenu.title.label = 'Open Tabs';
	tabsMenu.title.iconClass = 'bx bx-tabs';
	menuSelf.tabsMenu = tabsMenu;
	viewMenu.addItem({ type: 'submenu', submenu: tabsMenu });
	viewMenu.addItem({ type: 'separator' });
	tabsMenu.addItem({ type: 'separator' });
	tabsMenu.addItem({ command: 'next-tab' });
	tabsMenu.addItem({ command: 'previous-tab' });


}




/**
 * System Context Initialization
 */
export function initializeMenus(commands: CommandRegistry, menuBar: MenuBar, mainDock: DockPanel, toolbarNode: HTMLElement): void
{
	document.addEventListener('keydown', (event: KeyboardEvent) =>
	{
		commands.processKeydownEvent(event);
		updateModifierPressed(event);

	}, true);
	document.addEventListener('keyup', (event: KeyboardEvent) =>
	{
		commands.processKeyupEvent(event);
		updateModifierPressed(event);

	}, true);

	const viewMenu = new Menu({ commands });
	viewMenu.title.label = 'Window';

	initializeTabsMenu(commands, mainDock, viewMenu);

	// 1. Render the HTML list structural tree directly inside the left toolbar container node
	const ul = document.createElement('ul');
	Object.entries(MODULE_REGISTRY).forEach(([id, route]) =>
	{
		const li = document.createElement('li');
		const a = document.createElement('a');
		a.setAttribute('href', `#${id}`);
		a.setAttribute('title', route.label);
		a.className = route.iconClass;

		// Set 'active' style override state specifically for your engine files entry point
		if(id === 'filelist')
		{
			a.classList.add('active');
		}

		li.appendChild(a);
		ul.appendChild(li);

		// 2. Map standard commands to Top Menu Bar targets (skipping collapse navigation)
		if(route.url)
		{
			const commandId = `spawn-panel:${id}`;
			commands.addCommand(commandId, {
				label: route.label,
				iconClass: route.iconClass, // <-- Add this line to attach the Boxicon classes to the command
				execute: () => triggerPanelRoute(id, mainDock)
			});
			viewMenu.addItem({ command: commandId });
		}
	});

	toolbarNode.appendChild(ul);
	menuBar.addMenu(viewMenu);

	// 3. Isolated internal event capture handling bounded to the toolbar container
	toolbarNode.addEventListener('click', mainModuleHandler.bind(toolbarNode, mainDock, toolbarNode));
}


function mainModuleHandler(mainDock: DockPanel, toolbarNode: HTMLElement, event: MouseEvent)
{
	const anchor = (event.target as HTMLElement).closest('a');
	if(!anchor) return;

	const href = anchor.getAttribute('href');
	if(href && href.startsWith('#'))
	{
		event.preventDefault();
		const panelId = href.substring(1);

		// Manage localized highlight toggle styles across the sidebar icons
		toolbarNode.querySelectorAll('a').forEach(el => el.classList.remove('active'));
		if(panelId !== 'collapse')
		{
			anchor.classList.add('active');
		} else
		{
			const shouldCollapse = (menuSelf.fileListWidgets && menuSelf.fileListWidgets.length > 0)
				|| (menuSelf.terminalWidgets && menuSelf.terminalWidgets.length > 0);
			if(!shouldCollapse)
			{
				return;
			}
			console.log('Panel singleton toggle: ' + panelId);
			if(toolbarNode.classList.contains('collapsed'))
			{
				toolbarNode.classList.remove('collapsed');
				collapseWidgets(mainDock, false);
			} else
			{
				toolbarNode.classList.add('collapsed');
				collapseWidgets(mainDock, true);
			}
			return;
		}

		triggerPanelRoute(panelId, mainDock);
	}
}


function collapseWidgets(mainDock: DockPanel, collapse: boolean, route?: ComponentRoute)
{
	if(menuSelf.fileListWidgets && menuSelf.fileListWidgets.length > 0
		&& (!route || route.className && OUTLINE_WIDGET_TYPES.includes(route.className))
	)
	{
		if(collapse)
		{
			for(let widget of menuSelf.fileListWidgets)
			{
				widget.hide();
				widget.parent = null;
			}
		} else
		{
			for(let widget of menuSelf.fileListWidgets)
			{
				LayoutAdjuster.addOptimalWidgetLayout(mainDock, widget, {
					type: 'outline',
					projectId: widget.constructor.name
				});
			}
		}
	}

	if(menuSelf.terminalWidgets && menuSelf.terminalWidgets.length > 0
		&& (!route || route.className && route.className === 'TerminalWidget')
	)
	{
		if(collapse)
		{
			for(let widget of menuSelf.terminalWidgets)
			{
				widget.hide();
				widget.parent = null;
			}
		} else
		{
			for(let widget of menuSelf.terminalWidgets)
			{
				LayoutAdjuster.addOptimalWidgetLayout(mainDock, widget, {
					type: 'terminal',
					projectId: widget.constructor.name
				});
			}
		}
	}

	window.requestAnimationFrame(() =>
	{
		menuSelf.resizeHandler?.();
		setTimeout(() =>
		{
			menuSelf.resizeHandler?.();
		}, 200);
	});
}





/**
 * Main export to assemble and return the unified top header row.
 */
export function createTopBar(commands: CommandRegistry): TopBarComponents
{
	// 3. Assemble the base MenuBar
	const menuBar = new MenuBar({
		overflowMenuOptions: {
			isVisible: false
		}
	});
	menuSelf.globalMenuBar = menuBar;
	menuBar.id = 'top-menubar';

	const headerRow = new Panel();
	headerRow.id = 'app-top-header-row';
	headerRow.node.style.minHeight = '30px';

	// 4. Build the inline toolbar segment
	const repositoryToolbar = RepositoryToolbar.getInstance().initialize(commands);
	menuSelf.repositoryToolbar = repositoryToolbar;
	const scriptToolbar = ScriptToolbar.getInstance().initialize(commands);
	menuSelf.scriptToolbar = scriptToolbar;
	const appToolbar = ApplicationToolbar.getInstance().initialize(commands);
	menuSelf.appToolbar = appToolbar;
	const fileToolbar = FileToolbar.getInstance().initialize(commands);
	menuSelf.fileToolbar = fileToolbar;
	const editToolbar = EditToolbar.getInstance().initialize(commands);
	menuSelf.editToolbar = editToolbar;
	const viewToolbar = ViewToolbar.getInstance().initialize(commands);
	menuSelf.viewToolbar = viewToolbar;
	const layoutToolbar = LayoutToolbar.getInstance().initialize(commands);
	menuSelf.layoutToolbar = layoutToolbar;
	const historyToolbar = HistoryToolbar.getInstance().initialize(commands);
	menuSelf.historyToolbar = historyToolbar;
	const settingsToolbar = SettingsToolbar.getInstance().initialize(commands);
	menuSelf.settingsToolbar = settingsToolbar;

	headerRow.addWidget(menuBar);
	headerRow.addWidget(repositoryToolbar);
	headerRow.addWidget(scriptToolbar);
	headerRow.addWidget(appToolbar);
	headerRow.addWidget(fileToolbar);
	headerRow.addWidget(editToolbar);
	headerRow.addWidget(viewToolbar);
	headerRow.addWidget(layoutToolbar);
	headerRow.addWidget(historyToolbar);
	headerRow.addWidget(settingsToolbar);

	return { headerRow, menuBar };
}


let hashDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Parses and dispatches hash navigation routes.
 */
export async function renderHashCommand(targetHashName: string, noBounce: boolean = false): Promise<void>
{
	const rawTarget = (targetHashName || '').trim().replace(/^#/, '');

	if(hashDebounceTimer)
	{
		clearTimeout(hashDebounceTimer);
		hashDebounceTimer = null;
	}

	if(!noBounce)
	{
		hashDebounceTimer = setTimeout(() =>
		{
			renderHashCommand(rawTarget, true);
		}, 200);
		return;
	}

	if(!rawTarget || rawTarget.length === 0) return;
	menuSelf.previousHashLineNumber = null;
	try
	{
		menuSelf.renderingHashCommand = true;
		const matchedRoute = MODULE_REGISTRY[rawTarget] ?? TOOLS_REGISTRY[rawTarget];
		if(matchedRoute)
		{
			// Activate registered panel/widget via your main dock panel router
			if(menuSelf.mainDock)
			{
				await triggerPanelRoute(rawTarget, menuSelf.mainDock, true);
			}
			return;
		}

		const matchedTerminal = TERMINAL_REGISTRY.find(t => t.id === rawTarget);
		if(matchedTerminal)
		{
			if(menuSelf.mainDock)
			{
				await triggerPanelRoute('terminal-container', menuSelf.mainDock, true);
			}

			const currentDOMWidgets = Array.from(menuSelf.mainDock?.widgets() ?? []);

			// Locate any active TerminalWidget whose filterId or DOM element ID matches target
			const existingTerminalWidget = currentDOMWidgets.find((w: any) =>
				w.constructor?.name === 'TerminalWidget' &&
				(w.filterId === rawTarget || w.id === `terminal-panel-${rawTarget}` || w.id === rawTarget)
			);

			if(existingTerminalWidget)
			{
				// Activate and bring tab to front immediately
				menuSelf.mainDock?.activateWidget(existingTerminalWidget);
				existingTerminalWidget.activate();
				return;
			}
		}

		await FileManager.navigateFile(rawTarget);
	} catch(err)
	{
		console.error(`[HashRouter] Failed to resolve target file path for hash #${rawTarget}:`, err);
	} finally
	{
		menuSelf.renderingHashCommand = false;
	}
}

// ─── POPSTATE LISTENER BINDING ───
if(typeof window !== 'undefined')
{
	window.addEventListener('popstate', () =>
	{
		const activeHash = window.location.hash.substring(1);
		renderHashCommand(activeHash);
	});

	window.addEventListener('mousemove', (e: MouseEvent) =>
	{
		const globalTooltip = document.getElementById('global-tooltip');

		if(!globalTooltip) return;

		const target = e.target as HTMLElement;

		let targetEl: HTMLElement | null = null;
		let targetText: string | null | undefined = "";

		// 1. ISOLATED CHECK: Look for attributes assigned dynamically by our native plugin layer
		const aceContainer = target?.closest('.ace_editor') as HTMLElement;
		if(aceContainer)
		{
			// Pull error string markers
			targetText ||= aceContainer.getAttribute('data-compiler-error');

			// Pull code reference definition markers
			let navSymbol = aceContainer.getAttribute('data-navigation-target');
			if(navSymbol)
			{
				targetText = `Go to reference for definition: "${navSymbol}"`;
			}

			if(targetText)
			{
				targetEl = aceContainer;
			}
		}

		// 2. STANDARD MINIPAINT DOM ATTR FALLBACKS
		if(!targetText)
		{
			targetText ||= target.getAttribute('placeholder');
			targetText ||= target.getAttribute('alt');
			targetText ||= target.getAttribute('data-tooltip');
			targetText ||= target.getAttribute('title');
			if(targetText)
			{
				targetEl = target;
			}
		}

		if(!targetText && target.parentElement)
		{
			targetText ||= target.parentElement.getAttribute('placeholder');
			targetText ||= target.parentElement.getAttribute('alt');
			targetText ||= target.parentElement.getAttribute('data-tooltip');
			targetText ||= target.parentElement.getAttribute('title');
			if(targetText)
			{
				targetEl = target.parentElement;
			}
		}

		const closest = target.closest('[placeholder],[alt],[data-tooltip],[title],.pk_tb .pk_btn') as HTMLElement;
		if(!targetText && closest)
		{
			targetText ||= closest.getAttribute('placeholder');
			targetText ||= closest.getAttribute('alt');
			targetText ||= closest.getAttribute('data-tooltip');
			targetText ||= closest.getAttribute('title');
			targetText ||= closest.querySelector('span')?.innerText;
			if(targetText)
			{
				targetEl = closest;
			}
		}

		if(targetEl && targetEl.style.display === 'contents')
		{
			targetEl = targetEl.children[0] as HTMLElement;
		}


		if(!targetEl || !targetText)
		{
			globalTooltip.style.display = 'none';
			globalTooltip.style.opacity = '0';
			globalTooltip.style.zIndex = '-1';
			return;
		}

		if(!targetText) return;

		const hideAceErrors = document.querySelector('#global-editor-tooltip') as HTMLElement;
		if(hideAceErrors)
		{
			hideAceErrors.style.display = 'none';
		}

		globalTooltip.innerText = targetText;
		globalTooltip.style.display = 'block';
		globalTooltip.style.opacity = '1';
		globalTooltip.style.visibility = 'visible';
		globalTooltip.style.zIndex = '1000';

		// Fluid position layout tracking for tracking paths cleanly under cursor coordinates
		if(aceContainer)
		{
			globalTooltip.style.top = (e.clientY + 15) + 'px';
			globalTooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - globalTooltip.clientWidth - 20) + 'px';
		} else
		{
			const rect = targetEl.getBoundingClientRect();
			globalTooltip.style.top = (rect.top + targetEl.clientHeight) + 'px';
			globalTooltip.style.left = Math.min(rect.left + targetEl.clientWidth, window.innerWidth - globalTooltip.clientWidth - 20) + 'px';
		}
	});
}

