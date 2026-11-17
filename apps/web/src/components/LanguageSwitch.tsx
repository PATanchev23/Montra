import { LANGUAGE_NAMES, LANGUAGES, useLanguage, useMessages, type Language } from '../i18n';
import { common } from '../i18n/common';
import { useUiStore } from '../stores/ui';
import { SegmentedControl } from './ui/SegmentedControl';

/** English | Български: each language named in itself, so either reader can find theirs. */
export function LanguageSwitch({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  const language = useLanguage();
  const setLanguage = useUiStore((s) => s.setLanguage);
  const m = useMessages(common);
  return (
    <SegmentedControl<Language>
      label={m.account.language}
      size={size}
      value={language}
      onChange={setLanguage}
      options={LANGUAGES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }))}
      className={className}
    />
  );
}
