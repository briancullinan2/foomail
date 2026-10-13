import { Widget } from "@lumino/widgets";
import { ISignal, Signal } from "@lumino/signaling";
import { Message } from "@lumino/messaging";
import type * as openpgp from 'openpgp';
import type { GlobalToolbarsWindow, LuminoMenuWindow } from "../bundle/menu.d";
import type { LuminoLayoutWindow } from "../bundle/lumino.d";
import './openpgp.min.js';


export interface IPgpKeyProfile
{
	id: string;
	name: string;
	email: string;
	type: 'Public Key' | 'Private Key' | 'Key Pair';
	fingerprint: string;
	created: string;
	armoredData: string;
	isEncrypted: boolean;
}

const widgetSelf: GlobalToolbarsWindow & LuminoMenuWindow & LuminoLayoutWindow & {
	openpgp: typeof openpgp;
}
	= self as unknown as any;

export class PGPConfigWidget extends Widget
{
	private loadedKeys: IPgpKeyProfile[] = [];
	private dropZoneEl!: HTMLElement;
	private keyListEl!: HTMLElement;
	private inspectorDetailsEl!: HTMLElement;

	private nameInput!: HTMLInputElement;
	private emailInput!: HTMLInputElement;
	private passphraseInput!: HTMLInputElement;
	private keyTypeSelect!: HTMLSelectElement;

	private _keysChanged: Signal<PGPConfigWidget, IPgpKeyProfile[]> = new Signal(this);
	public get keysChanged(): ISignal<PGPConfigWidget, IPgpKeyProfile[]> { return this._keysChanged; }

	constructor()
	{
		super();
		this.title.label = 'PGP Key Configurator';
		this.title.iconClass = 'bx bx-key';
		this.title.closable = true;

		this.initDom();
	}

	public processMessage(msg: Message): void
	{
		if(msg.type === 'close-request')
		{
			this.hide();
			widgetSelf.mainDock?.layout?.removeWidget(this);
			return;
		}
		super.processMessage(msg);
	}

	protected override onAfterAttach(msg: Message): void
	{
		super.onAfterAttach(msg);
		this.renderKeyList();
	}

	private initDom(): void
	{
		this.addClass('pgp-config-root');
		this.node.innerHTML = `
            <div class="pgp-layout-container">
                <!-- Left Pane: Key Generator & Drop Zone -->
                <div class="pgp-panel pgp-generator-panel">
                    <div class="pgp-panel-header">
                        <h3><i class="bx bx-plus-circle"></i> Generate Key Pair</h3>
                    </div>
                    <div class="pgp-form-group">
                        <label>Full Name</label>
                        <input type="text" id="pgpName" placeholder="e.g., Brian Cullinan" class="pgp-input" value="Brian Cullinan" />
                    </div>
                    <div class="pgp-form-group">
                        <label>Email Address</label>
                        <input type="email" id="pgpEmail" placeholder="e.g., brian@briancullinan.com" class="pgp-input" value="brian@briancullinan.com" />
                    </div>
                    <div class="pgp-form-group">
                        <label>Algorithm / Curve</label>
                        <select id="pgpKeyType" class="pgp-select">
                            <option value="ed25519">Curve25519 / Ed25519 (Recommended)</option>
                            <option value="rsa4096">RSA 4096-bit (High Compatibility)</option>
                        </select>
                    </div>
                    <div class="pgp-form-group">
                        <label>Passphrase (Optional protection)</label>
                        <input type="password" id="pgpPassphrase" placeholder="Leave empty for unpassworded key" class="pgp-input" />
                    </div>
                    <button id="pgpGenerateBtn" class="pgp-btn primary"><i class="bx bx-shield-quarter"></i> Generate New Keys</button>

                    <hr class="pgp-divider" />

                    <!-- File Drop Zone for .asc, .gpg, .key -->
                    <div class="pgp-drop-zone" id="pgpDropZone">
                        <i class="bx bx-cloud-upload"></i>
                        <span>Drop PGP Key Files (.asc, .gpg, .key)</span>
                        <p>Automatically recognizes, classifies, and decrypts key rings</p>
                        <input type="file" id="pgpFileInput" accept=".asc,.gpg,.key,.txt" style="display:none" multiple />
                    </div>
                </div>

                <!-- Middle Pane: Loaded Key Ring List -->
                <div class="pgp-panel pgp-list-panel">
                    <div class="pgp-panel-header">
                        <h3><i class="bx bx-folder-open"></i> Key Ring Directory</h3>
                        <span id="pgpKeyCount" class="pgp-badge-count">0 keys</span>
                    </div>
                    <div class="pgp-list-container" id="pgpKeyList">
                        <!-- Populated dynamically -->
                    </div>
                </div>

                <!-- Right Pane: Inspector / Key Details -->
                <div class="pgp-panel pgp-inspector-panel" id="pgpInspector">
                    <div class="pgp-panel-header">
                        <h3><i class="bx bx-search-alt"></i> Key Inspector & Fingerprint</h3>
                    </div>
                    <div class="pgp-inspector-body" id="pgpInspectorBody">
                        <div class="pgp-empty-state">
                            <i class="bx bx-key"></i>
                            <p>Select a key from your directory or generate a new pair to inspect fingerprints, capabilities, and armored blocks.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

		this.dropZoneEl = this.node.querySelector('#pgpDropZone') as HTMLElement;
		this.keyListEl = this.node.querySelector('#pgpKeyList') as HTMLElement;
		this.inspectorDetailsEl = this.node.querySelector('#pgpInspectorBody') as HTMLElement;

		this.nameInput = this.node.querySelector('#pgpName') as HTMLInputElement;
		this.emailInput = this.node.querySelector('#pgpEmail') as HTMLInputElement;
		this.passphraseInput = this.node.querySelector('#pgpPassphrase') as HTMLInputElement;
		this.keyTypeSelect = this.node.querySelector('#pgpKeyType') as HTMLSelectElement;

		// Generator Action
		this.node.querySelector('#pgpGenerateBtn')?.addEventListener('click', () => this.generateKeyPair());

		// File Drop Handling
		const fileInput = this.node.querySelector('#pgpFileInput') as HTMLInputElement;
		this.dropZoneEl.addEventListener('click', () => fileInput.click());
		this.dropZoneEl.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
		this.dropZoneEl.addEventListener('drop', (e) =>
		{
			e.preventDefault();
			e.stopPropagation();
			if(e.dataTransfer?.files) this.handleFiles(e.dataTransfer.files);
		});
		fileInput.addEventListener('change', () =>
		{
			if(fileInput.files) this.handleFiles(fileInput.files);
		});
	}

	private async generateKeyPair(): Promise<void>
	{
		const name = this.nameInput.value.trim() || 'Anonymous';
		const email = this.emailInput.value.trim() || 'anon@local.dev';
		const passphrase = this.passphraseInput.value;
		const keyType = this.keyTypeSelect.value;

		try
		{
			let options: any = {
				userIDs: [{ name, email }],
				passphrase,
				format: 'armored'
			};

			if(keyType === 'ed25519')
			{
				options.type = 'ecc';
				options.curve = 'curve25519';
			}
			else
			{
				options.type = 'rsa';
				options.rsaBits = 4096;
			}

			const { privateKey, publicKey } = await widgetSelf.openpgp.generateKey(options);

			const pubObj = await widgetSelf.openpgp.readKey({ armoredKey: publicKey });
			const fingerprint = pubObj.getFingerprint();

			const profile: IPgpKeyProfile = {
				id: 'key-' + Math.random().toString(36).substring(2, 9),
				name,
				email,
				type: 'Key Pair',
				fingerprint,
				created: new Date().toLocaleDateString(),
				armoredData: privateKey + '\n' + publicKey,
				isEncrypted: passphrase.length > 0
			};

			this.loadedKeys.push(profile);
			this.renderKeyList();
			this.inspectKey(profile);
			this._keysChanged.emit(this.loadedKeys);
			alert('PGP Key Pair successfully generated locally!');
		}
		catch(err)
		{
			console.error('Key generation failed:', err);
			alert('Failed to generate key pair. Check console for details.');
		}
	}

	private async handleFiles(files: FileList): Promise<void>
	{
		for(let i = 0; i < files.length; i++)
		{
			const file = files[i];
			const text = await file.text();
			await this.parseAndClassifyKeyText(text, file.name);
		}
	}

	private async parseAndClassifyKeyText(armoredText: string, filename: string): Promise<void>
	{
		try
		{
			let keyType: 'Public Key' | 'Private Key' | 'Key Pair' = 'Public Key';
			let fingerprint = '';
			let name = filename;
			let email = 'Imported File';
			let isEncrypted = false;

			if(armoredText.includes('PRIVATE KEY BLOCK'))
			{
				keyType = armoredText.includes('PUBLIC KEY BLOCK') ? 'Key Pair' : 'Private Key';
				try
				{
					const privObj = await widgetSelf.openpgp.readPrivateKey({ armoredKey: armoredText });
					fingerprint = privObj.getFingerprint();
					isEncrypted = !privObj.isDecrypted();
				}
				catch
				{
					fingerprint = 'Unknown (Encrypted or Malformed)';
				}
			}
			else if(armoredText.includes('PUBLIC KEY BLOCK'))
			{
				keyType = 'Public Key';
				const pubObj = await widgetSelf.openpgp.readKey({ armoredKey: armoredText });
				fingerprint = pubObj.getFingerprint();
			}
			else
			{
				alert(`File ${filename} does not contain a recognized OpenPGP ASCII-armored header.`);
				return;
			}

			const profile: IPgpKeyProfile = {
				id: 'imported-' + Math.random().toString(36).substring(2, 9),
				name,
				email,
				type: keyType,
				fingerprint,
				created: new Date().toLocaleDateString(),
				armoredData: armoredText,
				isEncrypted
			};

			this.loadedKeys.push(profile);
			this.renderKeyList();
			this.inspectKey(profile);
			this._keysChanged.emit(this.loadedKeys);
		}
		catch(err)
		{
			console.error('Failed to parse dropped key file:', err);
			alert(`Could not parse ${filename} as a valid PGP key.`);
		}
	}

	private renderKeyList(): void
	{
		this.keyListEl.innerHTML = '';
		(this.node.querySelector('#pgpKeyCount') as HTMLElement).textContent = `${this.loadedKeys.length} keys`;

		if(this.loadedKeys.length === 0)
		{
			this.keyListEl.innerHTML = `<div class="pgp-empty">No keys loaded in ring</div>`;
			return;
		}

		this.loadedKeys.forEach(k =>
		{
			const item = document.createElement('div');
			item.className = 'pgp-key-item';
			item.innerHTML = `
                <div class="pgp-key-icon ${k.type.toLowerCase().replace(' ', '-')}">
                    <i class="bx ${k.type === 'Public Key' ? 'bx-lock-open' : 'bx-lock'}"></i>
                </div>
                <div class="pgp-key-details">
                    <span class="pgp-k-name">${this.escapeHTML(k.name)}</span>
                    <span class="pgp-k-type">${k.type} ${k.isEncrypted ? '• Passphrase Protected' : '• Unpassworded'}</span>
                </div>
            `;

			item.addEventListener('click', () => this.inspectKey(k));
			this.keyListEl.appendChild(item);
		});
	}

	private inspectKey(k: IPgpKeyProfile): void
	{
		this.inspectorDetailsEl.innerHTML = `
            <div class="pgp-inspector-card">
                <div class="pgp-ins-row">
                    <span class="pgp-ins-label">Identity / File</span>
                    <span class="pgp-ins-val">${this.escapeHTML(k.name)}</span>
                </div>
                <div class="pgp-ins-row">
                    <span class="pgp-ins-label">Classification</span>
                    <span class="pgp-ins-val highlight">${k.type}</span>
                </div>
                <div class="pgp-ins-row">
                    <span class="pgp-ins-label">Encryption State</span>
                    <span class="pgp-ins-val">${k.isEncrypted ? '🔒 Encrypted (Passworded)' : '🔓 Unpassworded / Clear'}</span>
                </div>
                <div class="pgp-ins-row">
                    <span class="pgp-ins-label">Fingerprint</span>
                    <code class="pgp-fingerprint">${k.fingerprint}</code>
                </div>
                <div class="pgp-ins-group">
                    <span class="pgp-ins-label">ASCII-Armored Block</span>
                    <textarea class="pgp-code-area" readonly>${k.armoredData}</textarea>
                </div>
                <div class="pgp-ins-actions">
                    <button class="pgp-btn secondary" id="pgpCopyKeyBtn"><i class="bx bx-copy"></i> Copy Armored Block</button>
                </div>
            </div>
        `;

		this.inspectorDetailsEl.querySelector('#pgpCopyKeyBtn')?.addEventListener('click', () =>
		{
			navigator.clipboard.writeText(k.armoredData);
			alert('Armored key copied to clipboard!');
		});
	}

	private escapeHTML(str: string): string
	{
		return (str || '').replace(/[&<>'"]/g,
			tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
		);
	}
}
