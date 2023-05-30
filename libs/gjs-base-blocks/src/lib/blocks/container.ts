import { Editor } from "@grapesjs/index";
import { makeBlockLabel } from "./label-factory";

export const ContainerBlock = (editor: Editor) => {
	editor.Blocks.add("container", {
		label:    makeBlockLabel("Container", "box-model"),
		category: "Basic",
		content:  {
			type: "container",
		},
	});
};