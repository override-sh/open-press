import { Editor } from "@grapesjs/index";
import { makeBlockLabel } from "./label-factory";

export const TextBlock = (editor: Editor) => {
	editor.Blocks.add("text", {
		label:    makeBlockLabel("Text", "alphabet-latin"),
		category: "Basic",
		content:  {
			type: "paragraph",
		},
	});
};