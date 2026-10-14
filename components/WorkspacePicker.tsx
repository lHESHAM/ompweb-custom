"use client";

import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Folder, GitBranch, Plus } from "lucide-react";

interface Option { value: string; label: string; description?: string }
interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  kind?: "workspace" | "worktree";
}

/** Portaled menu keeps workspace selection accessible and above the composer. */
export function WorkspacePicker({ label, value, options, onChange, onAdd, addLabel, kind = "workspace" }: Props) {
  const selected = options.find((option) => option.value === value);
  const Icon = kind === "worktree" ? GitBranch : Folder;
  return (
    <Menu.Root>
      <Menu.Trigger className="workspace-picker-trigger" aria-label={label + ": " + (selected?.label ?? value)} title={selected?.description ?? value}>
        <Icon size={14} aria-hidden="true" />
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={8} collisionPadding={12} className="workspace-picker-positioner">
          <Menu.Popup className="workspace-picker-menu">
            <Menu.Group>
              <Menu.GroupLabel className="workspace-picker-heading">{label}</Menu.GroupLabel>
              <Menu.RadioGroup value={value} onValueChange={(next: string) => onChange(next)}>
                {options.map((option) => (
                  <Menu.RadioItem key={option.value} value={option.value} label={option.label} closeOnClick className="workspace-picker-option">
                    <Icon size={16} aria-hidden="true" />
                    <span className="workspace-picker-option-text">
                      <span>{option.label}</span>
                      {option.description && <small title={option.description}>{option.description}</small>}
                    </span>
                    <Menu.RadioItemIndicator className="workspace-picker-check"><Check size={15} aria-hidden="true" /></Menu.RadioItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            {onAdd && <><Menu.Separator className="workspace-picker-separator" /><Menu.Item onClick={onAdd} className="workspace-picker-option workspace-picker-add"><Plus size={16} aria-hidden="true" /><span>{addLabel}</span></Menu.Item></>}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
