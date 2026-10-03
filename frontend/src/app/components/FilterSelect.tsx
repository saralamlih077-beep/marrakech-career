import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function FilterSelect({ value, onValueChange, options, label, id }: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  id?: string;
}) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger id={id} aria-label={label}
        className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[#EAE5E0] bg-white px-3.5 py-2.5 text-left text-sm font-medium text-[#1C1917] shadow-sm outline-none transition-colors hover:border-[#621E3E]/40 focus-visible:border-[#621E3E] focus-visible:ring-2 focus-visible:ring-[#621E3E]/15 data-[state=open]:border-[#621E3E] [&>span:first-child]:truncate">
        <Select.Value />
        <Select.Icon asChild><ChevronDown size={16} className="shrink-0 text-[#621E3E]" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" align="start" sideOffset={7} collisionPadding={12}
          className="z-[2000] overflow-hidden rounded-2xl border border-[#EAE5E0] bg-white p-1.5 text-[#1C1917] shadow-[0_12px_36px_rgba(98,30,62,0.16)]"
          style={{ width: 'var(--radix-select-trigger-width)', minWidth: 'min(280px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)', maxHeight: 'var(--radix-select-content-available-height)', fontFamily: "'Manrope', sans-serif" }}>
          <Select.ScrollUpButton className="flex h-6 items-center justify-center text-[#621E3E]"><ChevronUp size={16} /></Select.ScrollUpButton>
          <Select.Viewport style={{ maxHeight: 'min(320px, calc(var(--radix-select-content-available-height) - 48px))' }}>
            {options.map(option => (
              <Select.Item key={option.value} value={option.value}
                className="relative flex min-h-11 cursor-pointer items-center rounded-xl py-2.5 pl-3 pr-9 text-sm leading-snug outline-none select-none data-[highlighted]:bg-[#621E3E]/7 data-[highlighted]:text-[#621E3E] data-[state=checked]:bg-[#621E3E] data-[state=checked]:font-semibold data-[state=checked]:text-white">
                <Select.ItemText><span className="block break-words">{option.label}</span></Select.ItemText>
                <Select.ItemIndicator className="absolute right-3"><Check size={15} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-6 items-center justify-center text-[#621E3E]"><ChevronDown size={16} /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
