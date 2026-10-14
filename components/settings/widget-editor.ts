import { Widget } from "@lumino/widgets";

export class AceEditorSettings extends Widget
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
                    <label>Font Size</label>
                    <select class="config-input">
                        <option value="12px">12px</option>
                        <option value="13px" selected>13px</option>
                        <option value="14px">14px</option>
                        <option value="16px">16px</option>
                    </select>
                </div>

                <div class="config-field">
                    <label>Tab Size</label>
                    <select class="config-input">
                        <option value="2">2 Spaces</option>
                        <option value="4" selected>4 Spaces</option>
                    </select>
                </div>

                <div class="config-field checkbox-row">
                    <div class="checkbox-info">
                        <label>Live Autocompletion</label>
                        <span class="config-desc">Enable suggestions and snippets while typing.</span>
                    </div>
                    <input type="checkbox" checked class="config-checkbox" />
                </div>

                <div class="config-field checkbox-row">
                    <div class="checkbox-info">
                        <label>Highlight Active Line</label>
                        <span class="config-desc">Highlight the row containing the text cursor.</span>
                    </div>
                    <input type="checkbox" checked class="config-checkbox" />
                </div>

                <div class="config-field checkbox-row">
                    <div class="checkbox-info">
                        <label>Show Print Margin</label>
                        <span class="config-desc">Display vertical column guideline marker.</span>
                    </div>
                    <input type="checkbox" class="config-checkbox" />
                </div>

                <div class="config-field checkbox-row">
                    <div class="checkbox-info">
                        <label>Display Indent Guides</label>
                        <span class="config-desc">Show vertical dotted indentation lines.</span>
                    </div>
                    <input type="checkbox" checked class="config-checkbox" />
                </div>
            </div>
        `;
	}
}
