import type { CredentialRecord } from "./widget";

export class KeyParser
{
	public static db: IDBDatabase;

	// --- IndexedDB Management ---
	public static async initIndexedDB(): Promise<IDBDatabase>
	{
		return await new Promise((resolve, reject) =>
		{
			const request = indexedDB.open('LuminoPasswordVault', 1);
			request.onerror = () => reject(request.error);
			request.onsuccess = () =>
			{
				this.db = request.result;
				resolve(this.db);
			};
			request.onupgradeneeded = (event) =>
			{
				const db = (event.target as IDBOpenDBRequest).result;
				if(!db.objectStoreNames.contains('credentials'))
				{
					db.createObjectStore('credentials', { keyPath: 'id' });
				}
			};
		});
	}

	// --- File Ingestion & Parsing ---
	public static handleFileImport(files: FileList): void
	{
		Array.from(files).forEach(file =>
		{
			const reader = new FileReader();
			reader.onload = (e) =>
			{
				const content = e.target?.result as string;
				if(!content) return;

				if(file.name.endsWith('.json'))
				{
					try
					{
						const parsed = JSON.parse(content);
						const items = Array.isArray(parsed) ? parsed : [parsed];
						items.forEach((item: any) =>
						{
							const record: CredentialRecord = {
								id: 'imp-' + Math.random().toString(36).substring(2, 9),
								title: item.title || file.name,
								type: item.type || 'login',
								path: file.name,
								parent: '',
								domain: item.domain || 'imported.local',
								updatedAt: Date.now(),
								fields: item.fields || []
							};
							this.saveCredentialToDB(record);
						});
					} catch(err) { console.error('Invalid JSON format'); }
				} else if(file.name.endsWith('.csv'))
				{
					const lines = content.split('\n');
					lines.forEach((line, idx) =>
					{
						if(idx === 0 || !line.trim()) return; // skip header
						const parts = line.split(',');
						if(parts.length >= 2)
						{
							const record: CredentialRecord = {
								id: 'csv-' + Math.random().toString(36).substring(2, 9),
								title: parts[0]?.trim() || `CSV Import ${idx}`,
								type: 'login',
								path: file.name,
								parent: '',
								domain: parts[1]?.trim() || 'csv.local',
								updatedAt: Date.now(),
								fields: [
									{ id: 'f-1', type: 'username', name: 'username', value: parts[2]?.trim() || '' },
									{ id: 'f-2', type: 'password', name: 'password', value: parts[3]?.trim() || '' }
								]
							};
							this.saveCredentialToDB(record);
						}
					});
				} else
				{
					// Generic HTML / API Key Text scan
					const isApiKey = content.includes('AIza') || content.includes('key-') || content.length < 200;
					const record: CredentialRecord = {
						id: 'scan-' + Math.random().toString(36).substring(2, 9),
						title: file.name,
						type: isApiKey ? 'apikey' : 'securenote',
						path: file.name,
						parent: '',
						domain: 'scanned-file',
						updatedAt: Date.now(),
						fields: [
							{ id: 'f-1', type: isApiKey ? 'password' : 'text', name: isApiKey ? 'api_key' : 'content_dump', value: content.trim() }
						]
					};
					this.saveCredentialToDB(record);
				}
			};
			reader.readAsText(file);
		});
	}


	public static exportAllCredentials(credentials: CredentialRecord[]): void
	{
		const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(credentials, null, 2));
		const downloadAnchor = document.createElement('a');
		downloadAnchor.setAttribute("href", dataStr);
		downloadAnchor.setAttribute("download", `lumino_passwords_${Date.now()}.json`);
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		downloadAnchor.remove();
	}


	public static async saveCredentialToDB(record: CredentialRecord): Promise<CredentialRecord>
	{
		this.db ??= await this.initIndexedDB();
		return await new Promise((resolve, reject) =>
		{
			if(!this.db) return reject(new Error('No db'));
			const transaction = this.db.transaction(['credentials'], 'readwrite');
			const store = transaction.objectStore('credentials');
			store.put(record);
			transaction.oncomplete = () => resolve(record);
			transaction.onerror = () => reject(transaction.error);
		});
	}

	public static async deleteCredentialFromDB(id: string): Promise<void>
	{
		this.db ??= await this.initIndexedDB();
		return await new Promise((resolve, reject) =>
		{
			if(!this.db) return reject(new Error('No db'));
			const transaction = this.db.transaction(['credentials'], 'readwrite');
			const store = transaction.objectStore('credentials');
			store.delete(id);
			transaction.oncomplete = () => resolve();
			transaction.onerror = (e) => reject(transaction.error);
		});
	}

}
