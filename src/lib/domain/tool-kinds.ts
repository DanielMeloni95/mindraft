export const TOOL_KINDS = [
  { value: "tool", label: "Tool" },
  { value: "application", label: "Applicazione" },
  { value: "extension", label: "Estensione" },
  { value: "markjs", label: "MarkJS" },
  { value: "api", label: "API" },
  { value: "library", label: "Libreria" },
  { value: "service", label: "Servizio" },
] as const;

export type ToolKind = (typeof TOOL_KINDS)[number]["value"];

export function toolKindLabel(value: ToolKind): string {
  return TOOL_KINDS.find((item) => item.value === value)?.label ?? value;
}
