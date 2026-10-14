"use client";

import { Children, Fragment, isValidElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onChange" | "children"> {
  value: string | number;
  onValueChange: (value: string) => void;
  children: ReactNode;
  required?: boolean;
}
interface Option { value: string; label: ReactNode; disabled: boolean }
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)) return [];
    if (child.type === Fragment) return optionsFrom(child.props.children);
    if (child.type !== "option") return [];
    return [{ value: String(child.props.value ?? child.props.children ?? ""), label: child.props.children, disabled: Boolean(child.props.disabled) }];
  });
}

/** Shared custom selector: keyboard navigation, typeahead, and portaled options. */
export function PolishedSelect({ value, onValueChange, children, disabled, required, name, id, className, style, ...triggerProps }: Props) {
  const options = optionsFrom(children);
  return (
    <Select.Root value={String(value)} items={options} onValueChange={(next) => { if (next !== null) onValueChange(next); }} disabled={disabled} required={required} name={name} id={id}>
      <Select.Trigger {...triggerProps} id={id} className={["polished-select-trigger", className].filter(Boolean).join(" ")} style={style}>
        <Select.Value className="polished-select-value" />
        <Select.Icon className="polished-select-icon"><ChevronDown size={13} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={12} alignItemWithTrigger={false} className="polished-select-positioner">
          <Select.Popup className="polished-select-menu">
            <Select.List>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} disabled={option.disabled} className="polished-select-option">
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="polished-select-check"><Check size={14} aria-hidden="true" /></Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
