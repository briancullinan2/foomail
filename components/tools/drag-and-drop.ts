import type { LuminoLayoutWindow } from "../bundle/lumino.d";

export interface DropCapableWidget
{
	dropFiles(files: FileList): void | Promise<void>;
}

const dragSelf: LuminoLayoutWindow = self as unknown as any;

export class GlobalDropManager
{
	private static instance: GlobalDropManager | null = null;
	private isInitialized: boolean = false;
	private overlayEl: HTMLElement | null = null;
	private dragCounter: number = 0; // Tracks enter/leave nesting

	private constructor() { }

	public static init(): GlobalDropManager
	{
		if(!GlobalDropManager.instance)
		{
			GlobalDropManager.instance = new GlobalDropManager();
		}
		GlobalDropManager.instance.setupGlobalListeners();
		return GlobalDropManager.instance;
	}

	private setupGlobalListeners(): void
	{
		if(this.isInitialized) return;
		this.isInitialized = true;

		// Create coverall overlay element
		this.overlayEl = document.createElement('div');
		this.overlayEl.className = 'global-drop-overlay';
		this.overlayEl.innerHTML = `
            <div class="global-drop-card">
                <i class="bx bx-cloud-upload global-drop-icon"></i>
                <h2>Drop Files to Import</h2>
                <p>Release anywhere to send files to the active workspace or target zone.</p>
            </div>
        `;
		document.body.appendChild(this.overlayEl);

		// Prevent default browser behavior globally for drag/drop
		['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName =>
		{
			window.addEventListener(eventName, (e) =>
			{
				e.preventDefault();
				e.stopPropagation();
			}, false);
		});

		// Track drag enter/leave with a counter to prevent flicker on child elements
		window.addEventListener('dragenter', (e: DragEvent) =>
		{
			if(this.hasFiles(e))
			{
				this.dragCounter++;
				if(this.dragCounter === 1)
				{
					this.showOverlay();
				}
			}
		});

		window.addEventListener('dragleave', (e: DragEvent) =>
		{
			if(this.hasFiles(e))
			{
				this.dragCounter--;
				if(this.dragCounter <= 0)
				{
					this.dragCounter = 0;
					this.hideOverlay();
				}
			}
		});

		window.addEventListener('drop', async (e: DragEvent) =>
		{
			this.dragCounter = 0;
			this.hideOverlay();

			const files = e.dataTransfer?.files;
			if(!files || files.length === 0) return;

			// 1. Check if dropped directly onto a specific .dropzone-target
			const targetEl = (e.target as HTMLElement)?.closest('.dropzone-target');
			if(targetEl)
			{
				// Dispatch a custom event so the local target can handle it if desired
				const customDropEvent = new CustomEvent('target-dropped', {
					detail: { files },
					bubbles: true,
					cancelable: true
				});
				targetEl.dispatchEvent(customDropEvent);
				return;
			}

			// 2. Fall back to active Lumino widget with dropFiles method
			if(dragSelf.lastInteractedWidget
				&& 'dropFiles' in dragSelf.lastInteractedWidget
				&& typeof dragSelf.lastInteractedWidget.dropFiles === 'function')
			{
				try
				{
					await dragSelf.lastInteractedWidget.dropFiles(files);
				} catch(err)
				{
					console.error('Error processing dropped files in lastUsedWidget:', err);
				}
			} else
			{
				console.warn('GlobalDropManager: Files dropped, but no target or lastUsedWidget.dropFiles handler found.');
			}
		});
	}

	private hasFiles(e: DragEvent): boolean
	{
		if(!e.dataTransfer?.types) return false;
		return Array.from(e.dataTransfer.types).includes('Files');
	}

	private showOverlay(): void
	{
		document.body.classList.add('dragging');
		if(this.overlayEl)
		{
			this.overlayEl.classList.add('active');
		}
	}

	private hideOverlay(): void
	{
		document.body.classList.remove('dragging');
		if(this.overlayEl)
		{
			this.overlayEl.classList.remove('active');
		}
	}
}
