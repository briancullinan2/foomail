import { Widget } from "@lumino/widgets";

export class CoreSettings extends Widget
{
	constructor()
	{
		super();
		this.initDom();
	}

	private initDom(): void
	{
		this.addClass('sub-widget-pane');
		this.node.innerHTML = `
            <div class="config-form-grid">
                <div class="config-field">
                    <label>Workspace Default <span class="key-tag">workspace_default</span></label>
                    <span class="config-desc">Specifies the default active panel or system layout view presented to users upon launching the application interface.</span>
                    <select class="config-input">
                        <option value="email" selected>Email / Messages</option>
                        <option value="calendar">Calendar</option>
                        <option value="editor">Code Editor</option>
                    </select>
                </div>

                <div class="config-field">
                    <label>Environment Version <span class="key-tag">environment_version</span></label>
                    <span class="config-desc">The last commit date for the environment repository set automatically.</span>
                    <input type="text" class="config-input" value="1970-01-01T00:00:00.000Z" readonly />
                </div>

                <div class="config-field">
                    <label>Saved Theme <span class="key-tag">theme</span></label>
                    <span class="config-desc">The visual theme layout package used to style the interactive Ace code editor window background and syntax colors.</span>
                    <select class="config-input" id="themeSelect">
                        <option value="ace/theme/monokai" selected>Monokai (Dark)</option>
                        <option value="ace/theme/github">GitHub (Light)</option>
                        <option value="ace/theme/twilight">Twilight</option>
                        <option value="ace/theme/dracula">Dracula</option>
                    </select>
                </div>

                <div class="config-field">
                    <label>Layout State <span class="key-tag">layout</span></label>
                    <span class="config-desc">The layout order for opening new panels and resizing the window, snaps back to this state when the environment changes.</span>
                    <textarea class="config-textarea" rows="2">{"panels":"left-hand-files","order":"normal-order","terminal":"terminal","mode":"full-mode"}</textarea>
                </div>

                <div class="config-field">
                    <label>Target Configuration <span class="key-tag">configuration</span></label>
                    <span class="config-desc">Determines the target compilation profile rules, distinguishing targets such as full client builds or dedicated server binaries.</span>
                    <select class="config-input">
                        <option value="client" selected>Client Build</option>
                        <option value="server">Server Binary</option>
                    </select>
                </div>

                <div class="config-field checkbox-row">
                    <div class="checkbox-info">
                        <label>Hot Reload <span class="key-tag">hot_reload</span></label>
                        <span class="config-desc">When true, enables immediate compilation triggers and injection changes directly into the live executable WASM state upon saving files.</span>
                    </div>
                    <input type="checkbox" checked class="config-checkbox" />
                </div>
            </div>
        `;
	}
}
