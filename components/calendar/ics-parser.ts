export interface ICalendarEvent
{
	id: string;
	summary: string;
	description?: string;
	location?: string;
	start: Date;
	end: Date;
	isAllDay: boolean;
	rrule?: string;
}

export interface ICalendarData
{
	name: string;
	events: ICalendarEvent[];
}

export class ICalendarParser
{
	public static parse(icsText: string, defaultCalendarName: string = 'Imported Calendar'): ICalendarData
	{
		// Unfold lines (RFC 5545: lines starting with space or tab are continuations of previous line)
		const unfolded = icsText.replace(/\r\n[ \t]|\n[ \t]/g, '');
		const lines = unfolded.split(/\r\n|\n|\r/);

		let currentEvent: Partial<ICalendarEvent> | null = null;
		const events: ICalendarEvent[] = [];
		let calendarName = defaultCalendarName;
		let inTimeZone = false;

		for(let rawLine of lines)
		{
			const line = rawLine.trim();
			if(!line) continue;

			if(line === 'BEGIN:VEVENT')
			{
				currentEvent = { id: Math.random().toString(36).substring(2, 9) };
				continue;
			}

			if(line === 'END:VEVENT')
			{
				if(currentEvent && currentEvent.start && currentEvent.summary)
				{
					// Default end date if missing
					if(!currentEvent.end)
					{
						currentEvent.end = new Date(currentEvent.start.getTime() + 60 * 60 * 1000);
					}
					events.push(currentEvent as ICalendarEvent);
				}
				currentEvent = null;
				continue;
			}

			if(line.startsWith('BEGIN:VTIMEZONE'))
			{
				inTimeZone = true;
				continue;
			}

			if(line === 'END:VTIMEZONE')
			{
				inTimeZone = false;
				continue;
			}

			if(inTimeZone) continue;

			const colonIdx = line.indexOf(':');
			if(colonIdx === -1) continue;

			const fullKey = line.substring(0, colonIdx);
			const value = line.substring(colonIdx + 1);
			const keyParts = fullKey.split(';');
			const propName = keyParts[0].toUpperCase();
			const params = keyParts.slice(1);

			if(propName === 'X-WR-CALNAME')
			{
				calendarName = this.unescapeText(value);
			}

			if(currentEvent)
			{
				switch(propName)
				{
					case 'UID':
						currentEvent.id = value;
						break;
					case 'SUMMARY':
						currentEvent.summary = this.unescapeText(value);
						break;
					case 'DESCRIPTION':
						currentEvent.description = this.unescapeText(value);
						break;
					case 'LOCATION':
						currentEvent.location = this.unescapeText(value);
						break;
					case 'DTSTART':
						{
							const parsed = this.parseICSDate(value, params);
							currentEvent.start = parsed.date;
							currentEvent.isAllDay = parsed.isAllDay;
						}
						break;
					case 'DTEND':
						{
							const parsed = this.parseICSDate(value, params);
							currentEvent.end = parsed.date;
						}
						break;
					case 'RRULE':
						currentEvent.rrule = value;
						break;
				}
			}
		}

		return { name: calendarName, events };
	}

	private static parseICSDate(val: string, params: string[]): { date: Date; isAllDay: boolean; }
	{
		const isAllDay = params.some(p => p.toUpperCase().includes('VALUE=DATE')) || val.length === 8;

		if(isAllDay && val.length === 8)
		{
			const year = parseInt(val.substring(0, 4), 10);
			const month = parseInt(val.substring(4, 6), 10) - 1;
			const day = parseInt(val.substring(6, 8), 10);
			return { date: new Date(year, month, day), isAllDay: true };
		}

		// Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
		const cleanVal = val.replace('Z', '');
		const year = parseInt(cleanVal.substring(0, 4), 10);
		const month = parseInt(cleanVal.substring(4, 6), 10) - 1;
		const day = parseInt(cleanVal.substring(6, 8), 10);
		const hour = parseInt(cleanVal.substring(9, 11) || '0', 10);
		const minute = parseInt(cleanVal.substring(11, 13) || '0', 10);
		const second = parseInt(cleanVal.substring(13, 15) || '0', 10);

		const isUtc = val.endsWith('Z');
		let date: Date;
		if(isUtc)
		{
			date = new Date(Date.UTC(year, month, day, hour, minute, second));
		}
		else
		{
			date = new Date(year, month, day, hour, minute, second);
		}

		return { date, isAllDay: false };
	}

	private static unescapeText(str: string): string
	{
		return str
			.replace(/\\n/g, '\n')
			.replace(/\\,/g, ',')
			.replace(/\\;/g, ';')
			.replace(/\\\\/g, '\\');
	}
}
