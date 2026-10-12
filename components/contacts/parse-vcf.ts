

export interface VCardContact
{
	uid: string;
	categories: string; // Organizational group (e.g., Work, Friends, Engineering)
	fn: string;          // Formatted Name
	n: string;           // Structured Name (Last;First;Middle;Prefix;Suffix)
	nickname: string;
	email: string;
	tel: string;
	adr: string;         // Street;Extended;City;State;Zip;Country
	title: string;
	org: string;
	role: string;
	bday: string;
	url: string;
	note: string;
	tz: string;
	geo: string;
	rev: string;
}

export class ParseVCard
{

	public static parseVCardString(vcardData: string): VCardContact[]
	{
		const contacts: VCardContact[] = [];
		const cards = vcardData.split('BEGIN:VCARD');
		cards.forEach(cardText =>
		{
			if(!cardText.includes('END:VCARD')) return;

			const getField = (tag: string): string =>
			{
				const regex = new RegExp(`^${tag}(?:;[^:]*)?:(.*)$`, 'm');
				const match = cardText.match(regex);
				return match ? match[1].trim() : '';
			};

			const newContact: VCardContact = {
				uid: 'imp-' + Math.random().toString(36).substring(2, 9),
				categories: getField('CATEGORIES') || 'Imported',
				fn: getField('FN') || 'Unnamed Contact',
				n: getField('N'),
				nickname: getField('NICKNAME'),
				email: getField('EMAIL'),
				tel: getField('TEL'),
				adr: getField('ADR'),
				title: getField('TITLE'),
				org: getField('ORG'),
				role: getField('ROLE'),
				bday: getField('BDAY'),
				url: getField('URL'),
				note: getField('NOTE'),
				tz: getField('TZ'),
				geo: getField('GEO'),
				rev: new Date().toISOString()
			};

			contacts.push(newContact);
		});
		return contacts;
	}

	public static exportSingleVCard(c: VCardContact): void
	{
		const vcfContent = [
			'BEGIN:VCARD',
			'VERSION:3.0',
			`FN:${c.fn}`,
			`N:${c.n}`,
			c.nickname ? `NICKNAME:${c.nickname}` : '',
			c.email ? `EMAIL:${c.email}` : '',
			c.tel ? `TEL:${c.tel}` : '',
			c.adr ? `ADR:${c.adr}` : '',
			c.org ? `ORG:${c.org}` : '',
			c.title ? `TITLE:${c.title}` : '',
			c.role ? `ROLE:${c.role}` : '',
			c.bday ? `BDAY:${c.bday}` : '',
			c.url ? `URL:${c.url}` : '',
			c.note ? `NOTE:${c.note}` : '',
			c.categories ? `CATEGORIES:${c.categories}` : '',
			c.tz ? `TZ:${c.tz}` : '',
			c.geo ? `GEO:${c.geo}` : '',
			`REV:${c.rev}`,
			`UID:${c.uid}`,
			'END:VCARD'
		].filter(Boolean).join('\r\n');

		const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${c.fn.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.vcf`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	public static createNewContact(group?: string): VCardContact
	{
		const newC: VCardContact = {
			uid: 'c-' + Math.random().toString(36).substr(2, 9),
			categories: !group || group === 'All' ? 'General' : group,
			fn: 'New Contact',
			n: ';New;;;',
			nickname: '',
			email: '',
			tel: '',
			adr: ';;;;;;',
			title: '',
			org: '',
			role: '',
			bday: '',
			url: '',
			note: '',
			tz: '',
			geo: '',
			rev: new Date().toISOString()
		};
		return newC;
	}

}
