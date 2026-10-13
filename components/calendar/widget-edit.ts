import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import { ICalendarEvent } from "./ics-parser";
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow
	= self as unknown as any;

export class EventEditorWidget extends Widget
{
	private eventData: ICalendarEvent;
	private isNew: boolean;

	private _saveRequested: Signal<EventEditorWidget, ICalendarEvent> = new Signal(this);
	public get saveRequested(): ISignal<EventEditorWidget, ICalendarEvent> { return this._saveRequested; }

	private _cancelRequested: Signal<EventEditorWidget, void> = new Signal(this);
	public get cancelRequested(): ISignal<EventEditorWidget, void> { return this._cancelRequested; }

	constructor(event?: Partial<ICalendarEvent>)
	{
		super();
		this.title.label = event?.summary ? `Edit: ${event.summary}` : 'New Event';
		this.title.iconClass = 'bx bx-calendar-edit';
		this.title.closable = true;

		this.isNew = !event?.id;
		this.eventData = {
			id: event?.id || 'evt-' + Math.random().toString(36).substring(2, 9),
			summary: event?.summary || '',
			description: event?.description || '',
			location: event?.location || '',
			start: event?.start || new Date(),
			end: event?.end || new Date(Date.now() + 60 * 60 * 1000),
			isAllDay: event?.isAllDay || false,
			rrule: event?.rrule || ''
		};

		this.initDom();
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.populateFields();
	}

	private initDom(): void
	{
		this.addClass('cal-editor-root');
		this.node.innerHTML = `
            <div class="cal-editor-container">
                <header class="cal-editor-header">
                    <h2>${this.isNew ? 'Create Event' : 'Edit Event Details'}</h2>
                    <div class="cal-editor-actions-top">
                        <button id="calEditorCancel" class="cal-btn secondary">Cancel</button>
                        <button id="calEditorSave" class="cal-btn primary"><i class="bx bx-check"></i> Save Event</button>
                    </div>
                </header>

                <div class="cal-editor-body">
                    <!-- Title / Summary -->
                    <div class="cal-field-group full-width">
                        <input type="text" id="calSummaryInput" placeholder="Add title" class="cal-input-title" />
                    </div>

                    <!-- Date & Time Row -->
                    <div class="cal-row-grid">
                        <div class="cal-field-group">
                            <label><i class="bx bx-time"></i> Start Time</label>
                            <div class="cal-datetime-inputs">
                                <input type="date" id="calStartDate" />
                                <input type="time" id="calStartTime" />
                            </div>
                        </div>
                        <div class="cal-field-group">
                            <label><i class="bx bx-time-five"></i> End Time</label>
                            <div class="cal-datetime-inputs">
                                <input type="date" id="calEndDate" />
                                <input type="time" id="calEndTime" />
                            </div>
                        </div>
                    </div>

                    <!-- All Day & Recurrence Options -->
                    <div class="cal-row-grid sub-options">
                        <div class="cal-field-group checkbox-group">
                            <label>
                                <input type="checkbox" id="calAllDayCheck" />
                                <span>All-day event</span>
                            </label>
                        </div>
                        <div class="cal-field-group">
                            <label for="calRRuleSelect"><i class="bx bx-repeat"></i> Recurrence (RRULE)</label>
                            <select id="calRRuleSelect" class="cal-select">
                                <option value="">Does not repeat</option>
                                <option value="FREQ=DAILY">Daily</option>
                                <option value="FREQ=WEEKLY">Weekly</option>
                                <option value="FREQ=MONTHLY">Monthly</option>
                                <option value="FREQ=YEARLY">Yearly</option>
                            </select>
                        </div>
                    </div>

                    <hr class="cal-divider" />

                    <!-- Location -->
                    <div class="cal-field-group">
                        <label for="calLocationInput"><i class="bx bx-map"></i> Location</label>
                        <input type="text" id="calLocationInput" placeholder="Add location or virtual meeting link" class="cal-input" />
                    </div>

                    <!-- Description / Notes -->
                    <div class="cal-field-group">
                        <label for="calDescInput"><i class="bx bx-align-left"></i> Description & Agenda</label>
                        <textarea id="calDescInput" placeholder="Add description, attachments, or meeting notes..." rows="6" class="cal-textarea"></textarea>
                    </div>

                    <!-- Advanced ICS Metadata Readout / Custom Parameters -->
                    <div class="cal-field-group advanced-meta">
                        <span class="cal-meta-title"><i class="bx bx-code-alt"></i> ICS Identifier (UID)</span>
                        <code id="calUidDisplay"></code>
                    </div>
                </div>
            </div>
        `;

		// Bind Action Listeners
		this.node.querySelector('#calEditorCancel')?.addEventListener('click', () =>
		{
			this._cancelRequested.emit();
			this.close();
		});

		this.node.querySelector('#calEditorSave')?.addEventListener('click', () =>
		{
			this.collectFormValues();
			this._saveRequested.emit(this.eventData);
			this.close();
		});

		this.node.querySelector('#calAllDayCheck')?.addEventListener('change', (e) =>
		{
			const isChecked = (e.target as HTMLInputElement).checked;
			const timeInputs = this.node.querySelectorAll('input[type="time"]') as NodeListOf<HTMLInputElement>;
			timeInputs.forEach(ti => ti.disabled = isChecked);
		});
	}

	private populateFields(): void
	{
		(this.node.querySelector('#calSummaryInput') as HTMLInputElement).value = this.eventData.summary;
		(this.node.querySelector('#calLocationInput') as HTMLInputElement).value = this.eventData.location || '';
		(this.node.querySelector('#calDescInput') as HTMLTextAreaElement).value = this.eventData.description || '';
		(this.node.querySelector('#calRRuleSelect') as HTMLSelectElement).value = this.eventData.rrule || '';
		(this.node.querySelector('#calUidDisplay') as HTMLElement).textContent = this.eventData.id;

		const allDayCheck = this.node.querySelector('#calAllDayCheck') as HTMLInputElement;
		allDayCheck.checked = this.eventData.isAllDay;

		this.setDateTimeInputs(this.eventData.start, '#calStartDate', '#calStartTime');
		this.setDateTimeInputs(this.eventData.end, '#calEndDate', '#calEndTime');

		if(this.eventData.isAllDay)
		{
			this.node.querySelectorAll('input[type="time"]').forEach(ti => (ti as HTMLInputElement).disabled = true);
		}
	}

	private setDateTimeInputs(date: Date, dateSelector: string, timeSelector: string): void
	{
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		(this.node.querySelector(dateSelector) as HTMLInputElement).value = `${year}-${month}-${day}`;
		(this.node.querySelector(timeSelector) as HTMLInputElement).value = `${hours}:${minutes}`;
	}

	private collectFormValues(): void
	{
		this.eventData.summary = (this.node.querySelector('#calSummaryInput') as HTMLInputElement).value.trim() || 'Untitled Event';
		this.eventData.location = (this.node.querySelector('#calLocationInput') as HTMLInputElement).value.trim();
		this.eventData.description = (this.node.querySelector('#calDescInput') as HTMLTextAreaElement).value.trim();
		this.eventData.rrule = (this.node.querySelector('#calRRuleSelect') as HTMLSelectElement).value;
		this.eventData.isAllDay = (this.node.querySelector('#calAllDayCheck') as HTMLInputElement).checked;

		const startDateStr = (this.node.querySelector('#calStartDate') as HTMLInputElement).value;
		const startTimeStr = (this.node.querySelector('#calStartTime') as HTMLInputElement).value || '09:00';
		this.eventData.start = this.parseInputDate(startDateStr, startTimeStr, this.eventData.isAllDay);

		const endDateStr = (this.node.querySelector('#calEndDate') as HTMLInputElement).value;
		const endTimeStr = (this.node.querySelector('#calEndTime') as HTMLInputElement).value || '10:00';
		this.eventData.end = this.parseInputDate(endDateStr, endTimeStr, this.eventData.isAllDay);
	}

	private parseInputDate(dateStr: string, timeStr: string, isAllDay: boolean): Date
	{
		if(!dateStr) return new Date();
		const [y, m, d] = dateStr.split('-').map(Number);
		if(isAllDay)
		{
			return new Date(y, m - 1, d);
		}
		const [hh, mm] = timeStr.split(':').map(Number);
		return new Date(y, m - 1, d, hh, mm);
	}
}
