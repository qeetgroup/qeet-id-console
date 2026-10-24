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

import { LANGUAGE_LABELS, OFFERED_LANGUAGES, type OfferedLanguage } from "@/i18n";

/**
 * Renders the header's language picker over `OFFERED_LANGUAGES`, or nothing while there is only
 * one. The i18next detector persists the choice in `localStorage` (`qeetid.lang`).
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  if (OFFERED_LANGUAGES.length < 2) return null;

  const current: OfferedLanguage =
    OFFERED_LANGUAGES.find((lng) => lng === i18n.resolvedLanguage) ?? OFFERED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("language.current", { language: LANGUAGE_LABELS[current] })}
            title={t("language.change")}
          />
        }
      >
        <LanguagesIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44 rounded-lg" align="end" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t("language.label")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(lng) => lng && void i18n.changeLanguage(lng)}
        >
          {OFFERED_LANGUAGES.map((lng) => (
            <DropdownMenuRadioItem key={lng} value={lng}>
              {LANGUAGE_LABELS[lng]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
