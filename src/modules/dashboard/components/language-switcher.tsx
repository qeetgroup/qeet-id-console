import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { LanguagesIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";

/**
 * Renders the header's language picker over `SUPPORTED_LANGUAGES`. The i18next detector persists
 * the choice in `localStorage` (`qeetid.lang`).
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const current = (
    SUPPORTED_LANGUAGES.includes(i18n.resolvedLanguage as SupportedLanguage)
      ? (i18n.resolvedLanguage as SupportedLanguage)
      : SUPPORTED_LANGUAGES[0]
  ) as SupportedLanguage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Language: ${LANGUAGE_LABELS[current]}`}
            title="Change language"
          />
        }
      >
        <LanguagesIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44 rounded-lg" align="end" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">Language</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(lng) => lng && void i18n.changeLanguage(lng)}
        >
          {SUPPORTED_LANGUAGES.map((lng) => (
            <DropdownMenuRadioItem key={lng} value={lng}>
              {LANGUAGE_LABELS[lng]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
