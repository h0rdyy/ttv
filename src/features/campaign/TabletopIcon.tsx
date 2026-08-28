import type { SVGProps } from 'react';

export type TabletopIconName =
  | 'game'
  | 'characters'
  | 'tools'
  | 'dice'
  | 'search'
  | 'ruler'
  | 'ping'
  | 'draw'
  | 'trash'
  | 'close'
  | 'combat'
  | 'prepare'
  | 'scene'
  | 'library'
  | 'notes'
  | 'workshop'
  | 'eye'
  | 'sheet'
  | 'clear';

type Props = SVGProps<SVGSVGElement> & { name: TabletopIconName };

export function TabletopIcon({ name, ...props }: Props) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  return (
    <svg {...common} {...props}>
      {name === 'game' && <><path d="M4 12h16"/><path d="M12 4v16"/><circle cx="12" cy="12" r="3"/></>}
      {name === 'characters' && <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-4 3-6 5.5-6s4.7 2 5.5 6"/><circle cx="17" cy="9" r="2.2"/><path d="M15.5 14.2c2.9-.2 4.7 1.5 5 4.3"/></>}
      {name === 'tools' && <><path d="M4 19 14.5 8.5"/><path d="m13 5 2-2 6 6-2 2"/><path d="m5 14 5 5"/></>}
      {name === 'dice' && <><path d="m12 2 8 5v10l-8 5-8-5V7z"/><path d="m4 7 8 5 8-5M12 12v10"/><circle cx="12" cy="7" r=".8" fill="currentColor" stroke="none"/><circle cx="8" cy="15" r=".8" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r=".8" fill="currentColor" stroke="none"/></>}
      {name === 'search' && <><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></>}
      {name === 'ruler' && <><path d="M3 16.5 16.5 3 21 7.5 7.5 21z"/><path d="m9 12 2 2M12 9l2 2M15 6l2 2"/></>}
      {name === 'ping' && <><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></>}
      {name === 'draw' && <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10z"/><path d="m13.5 6.5 3.5 3.5"/><path d="M3 21h7"/></>}
      {name === 'trash' && <><path d="M4 7h16M9 3h6l1 4H8zM7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></>}
      {name === 'close' && <><path d="m6 6 12 12M18 6 6 18"/></>}
      {name === 'combat' && <><path d="m4 4 16 16M20 4 4 20"/><path d="m6 3-3 3 4 4M18 3l3 3-4 4"/></>}
      {name === 'prepare' && <><path d="M4 20 20 4M14 4l6 6M4 14l6 6"/><circle cx="7" cy="7" r="3"/></>}
      {name === 'scene' && <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m6 16 4-4 3 3 2-2 3 3"/><circle cx="16.5" cy="8.5" r="1.5"/></>}
      {name === 'library' && <><path d="M5 4h5v16H5zM10 5h5v15h-5zM15 3h4v17h-4z"/></>}
      {name === 'notes' && <><path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>}
      {name === 'workshop' && <><path d="M14 5a4 4 0 0 0 5 5L11 18l-5 2 2-5 8-8"/><path d="m4 4 5 5"/></>}
      {name === 'eye' && <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6"/><circle cx="12" cy="12" r="2.5"/></>}
      {name === 'sheet' && <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6"/></>}
      {name === 'clear' && <><path d="m4 15 9-9 5 5-9 9H4z"/><path d="m11 18 7-7M3 21h18"/></>}
    </svg>
  );
}
