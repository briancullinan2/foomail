import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import { ICalendarData, ICalendarEvent, ICalendarParser } from "./ics-parser";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import type { CalendarWidget } from "./widget";
import type { IMainpanelOptions, WidgetExtensionsWindow } from "../bundle/widget-extensions";

export interface ICalendarSource
{
	id: string;
	name: string;
	color: string;
	enabled: boolean;
	isRemote?: boolean;
	url?: string;
	events: ICalendarEvent[];
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	& WidgetExtensionsWindow = self as unknown as any;

export class CalendarSidebar extends widgetSelf.SidebarUpdateWidget<CalendarWidget, ICalendarSource[]>
{
	private calendarListEl!: HTMLElement;
	private miniCalendarEl!: HTMLElement;
	private searchInput!: HTMLInputElement;

	private currentDisplayDate: Date = new Date();

	private _selectedDate: Signal<CalendarSidebar, Date> = new Signal(this);
	public get selectedDate(): ISignal<CalendarSidebar, Date> { return this._selectedDate; }

	private _calendarsChanged: Signal<CalendarSidebar, ICalendarSource[]> = new Signal(this);
	public get calendarsChanged(): ISignal<CalendarSidebar, ICalendarSource[]> { return this._calendarsChanged; }

	private _selectedCalendars: Signal<CalendarSidebar, ICalendarSource[]> = new Signal(this);

	public get selectedCalendars(): ISignal<CalendarSidebar, ICalendarSource[]>
	{
		return this._selectedCalendars;
	}

	constructor(title?: string, options?: IMainpanelOptions<CalendarWidget, ICalendarSource[]>)
	{
		super(CalendarSidebar.name, options);
		this.title.label = title ?? 'Calendars';
		this.title.iconClass = 'bx bx-card-view-tiles';
		this.title.closable = true;
		this.initDom();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.loadDefaultCalendars();
		this.renderMiniCalendar();
	}

	private initDom(): void
	{
		this.node.innerHTML = `
            <div class="cal-sidebar-container">
                <div class="cal-action-bar">
                    <button id="calCreateBtn" class="cal-btn-create">
                        <i class="bx bx-plus"></i><span>Create Event</span>
                    </button>
                    <label class="cal-drop-zone-label" title="Drop .ics files here">
                        <i class="bx bx-calendar-up-arrow"></i>
                        <input type="file" id="calFileDrop" accept=".ics" style="display:none" multiple />
                    </label>
                    <button id="calAddRemoteBtn" class="cal-btn-icon" title="Add Subscribable / Remote Calendar">
                        <i class="bx bx-globe"></i>
                    </button>
                </div>

                <div class="cal-search-bar">
                    <i class="bx bx-search"></i>
                    <input type="text" id="calSearchInput" placeholder="Search events or calendars..." />
                </div>

                <div class="cal-mini-picker" id="calMiniPicker">
                    <!-- Mini Month Calendar Switcher Populated Dynamically -->
                </div>

                <div class="cal-list" id="calListItems">
                    <!-- Calendar checkboxes populated dynamically -->
                </div>
            </div>
        `;

		this.calendarListEl = this.node.querySelector('#calListItems') as HTMLElement;
		this.miniCalendarEl = this.node.querySelector('#calMiniPicker') as HTMLElement;
		this.searchInput = this.node.querySelector('#calSearchInput') as HTMLInputElement;

		// File drop support
		const dropZone = this.node.querySelector('.cal-sidebar-container') as HTMLElement;
		dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
		dropZone.addEventListener('drop', (e) =>
		{
			e.preventDefault();
			e.stopPropagation();
			if(e.dataTransfer?.files)
			{
				this.handleFileDrops(e.dataTransfer.files);
			}
		});

		const fileInput = this.node.querySelector('#calFileDrop') as HTMLInputElement;
		fileInput.addEventListener('change', (e) =>
		{
			if(fileInput.files) this.handleFileDrops(fileInput.files);
		});

		// Remote Calendar Subscribe Button
		this.node.querySelector('#calAddRemoteBtn')?.addEventListener('click', () =>
		{
			const url = prompt('Enter Subscribable ICS/Remote Calendar URL (HTTPS):');
			if(url) this.subscribeRemoteCalendar(url);
		});
	}

	private loadDefaultCalendars(): void
	{
		this.items = [
			{
				id: 'primary',
				name: 'Personal & Work',
				color: '#1a73e8',
				enabled: true,
				events: [
					{
						id: 'evt-1',
						summary: 'Architecture Sync with Platform Team',
						start: new Date(new Date().setHours(10, 0, 0, 0)),
						end: new Date(new Date().setHours(11, 0, 0, 0)),
						isAllDay: false,
						location: 'Zoom Virtual Room'
					},
					{
						id: 'evt-2',
						summary: 'Release Deadline: Q3 WebAssembly Runtime',
						start: new Date(),
						end: new Date(),
						isAllDay: true
					}
				]
			},
			{
				id: 'reminders',
				name: 'Reminders & Tasks',
				color: '#33b679',
				enabled: true,
				events: []
			}
		];
		this._calendarsChanged.emit(this.items);
	}

	private renderMiniCalendar(): void
	{
		const year = this.currentDisplayDate.getFullYear();
		const month = this.currentDisplayDate.getMonth();

		const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

		const firstDayIndex = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();

		let html = `
            <div class="cal-mini-header">
                <span class="cal-mini-title">${monthNames[month]} ${year}</span>
                <div class="cal-mini-nav">
                    <button id="calPrevMonth"><i class="bx bx-chevron-left"></i></button>
                    <button id="calNextMonth"><i class="bx bx-chevron-right"></i></button>
                </div>
            </div>
            <div class="cal-mini-grid">
                <div class="cal-day-lbl">S</div><div class="cal-day-lbl">M</div><div class="cal-day-lbl">T</div>
                <div class="cal-day-lbl">W</div><div class="cal-day-lbl">T</div><div class="cal-day-lbl">F</div>
                <div class="cal-day-lbl">S</div>
        `;

		for(let i = 0; i < firstDayIndex; i++)
		{
			html += `<div class="cal-day empty"></div>`;
		}

		const today = new Date();
		for(let day = 1; day <= daysInMonth; day++)
		{
			const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
			html += `<div class="cal-day ${isToday ? 'today' : ''}" data-day="${day}">${day}</div>`;
		}

		html += `</div>`;
		this.miniCalendarEl.innerHTML = html;

		// Bind Switcher Controls
		this.miniCalendarEl.querySelector('#calPrevMonth')?.addEventListener('click', () =>
		{
			this.currentDisplayDate.setMonth(this.currentDisplayDate.getMonth() - 1);
			this.renderMiniCalendar();
		});

		this.miniCalendarEl.querySelector('#calNextMonth')?.addEventListener('click', () =>
		{
			this.currentDisplayDate.setMonth(this.currentDisplayDate.getMonth() + 1);
			this.renderMiniCalendar();
		});

		this.miniCalendarEl.querySelectorAll('.cal-day:not(.empty)').forEach(el =>
		{
			el.addEventListener('click', (e) =>
			{
				const day = parseInt((e.currentTarget as HTMLElement).getAttribute('data-day') || '1', 10);
				const selected = new Date(year, month, day);
				this._selectedDate.emit(selected);
			});
		});
	}

	protected filterAndRender(): void
	{
		this.calendarListEl.innerHTML = '';
		this.items?.forEach(cal =>
		{
			const item = document.createElement('div');
			item.className = `cal-list-item ${cal.enabled ? 'active' : ''}`;
			item.innerHTML = `
                <label class="cal-checkbox-wrapper" style="--cal-color: ${cal.color}">
                    <input type="checkbox" ${cal.enabled ? 'checked' : ''} data-cal-id="${cal.id}" />
                    <span class="cal-checkmark"></span>
                    <span class="cal-name" title="${cal.name}">${this.escapeHTML(cal.name)}</span>
                    ${cal.isRemote ? '<i class="bx bx-globe cal-remote-icon" title="Subscribable Remote Calendar"></i>' : ''}
                </label>
            `;

			const checkbox = item.querySelector('input') as HTMLInputElement;
			checkbox.addEventListener('change', () =>
			{
				cal.enabled = checkbox.checked;
				item.classList.toggle('active', cal.enabled);
				this._calendarsChanged.emit(this.items ?? []);
			});

			this.calendarListEl.appendChild(item);
		});
	}

	private async handleFileDrops(files: FileList): Promise<void>
	{
		for(let i = 0; i < files.length; i++)
		{
			const file = files[i];
			if(!file.name.endsWith('.ics')) continue;
			try
			{
				const text = await file.text();
				const parsedData = ICalendarParser.parse(text, file.name.replace('.ics', ''));
				this.addCalendarSource({
					id: 'ics-' + Math.random().toString(36).substring(2, 9),
					name: parsedData.name,
					color: this.getRandomColor(),
					enabled: true,
					isRemote: false,
					events: parsedData.events
				});
			}
			catch(err)
			{
				console.error('Failed to parse dropped .ics file:', err);
			}
		}
	}

	private async subscribeRemoteCalendar(url: string): Promise<void>
	{
		try
		{
			// Note: Subject to CORS if fetching external URLs directly in browser without proxy
			const response = await fetch(url);
			const text = await response.text();
			const parsedData = ICalendarParser.parse(text, 'Remote Subscribed Calendar');

			this.addCalendarSource({
				id: 'remote-' + Math.random().toString(36).substring(2, 9),
				name: parsedData.name,
				color: '#d93025',
				enabled: true,
				isRemote: true,
				url,
				events: parsedData.events
			});
		}
		catch(err)
		{
			alert('Could not fetch remote calendar. Verify CORS headers or network connection.');
			console.error(err);
		}
	}

	private addCalendarSource(source: ICalendarSource): void
	{
		this.items?.push(source);
		this.filterAndRender();
		this._calendarsChanged.emit([source]);
	}

	private getRandomColor(): string
	{
		const colors = ['#f4511e', '#039be5', '#33b679', '#8e24aa', '#e67c73', '#f6bf26'];
		return colors[Math.floor(Math.random() * colors.length)];
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
