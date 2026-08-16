'use client';

import { useEffect, useState } from 'react';
import { TabletopContextUi } from './TabletopContextUi';

type Mode = 'gm' | 'player';

type Props = {
  mode: Mode;
  campaignName: string;
  activeSceneName: string | null;
  combatActive: boolean;
  combatRound: number;
  focusActive: boolean;
};

/*
 * Compatibility entry point while OnlineTableV05 still imports TabletopShellV2.
 * The visible v2 rail is gone: this adapter only promotes the existing table
 * root to the contextual v3 shell and keeps the migration isolated from table
 * business logic.
 */
export function TabletopShellV2({
  mode,
  campaignName,
  activeSceneName,
  combatActive,
  combatRound,
  focusActive,
}: Props) {
  const [uiHidden, setUiHidden] = useState(false);

  useEffect(() => {
    const root = document.querySelector('.v05-table-layer.tabletop-shell-v2');
    if (!(root instanceof HTMLElement)) return;

    root.classList.add('tabletop-shell-v3');
    root.classList.toggle('ui-chrome-hidden', uiHidden);
    root.classList.toggle('table-context-combat', combatActive);

    return () => {
      root.classList.remove('tabletop-shell-v3', 'ui-chrome-hidden', 'table-context-combat');
    };
  }, [combatActive, uiHidden]);

  return (
    <TabletopContextUi
      mode={mode}
      campaignName={campaignName}
      activeSceneName={activeSceneName}
      combatActive={combatActive}
      combatRound={combatRound}
      focusActive={focusActive}
      uiHidden={uiHidden}
      canOpenCharacter={false}
      onOpenCharacter={() => undefined}
      onUiHiddenChange={setUiHidden}
    />
  );
}
