/** ไอคอนสถานที่และชมรมเป็น SVG เส้น แทนอักขระยูนิโคดที่ฟอนต์แต่ละเครื่องวาดไม่เหมือนกัน */
const P: Record<string, string> = {
  classroom: 'M3 20h18M5 20V9l7-5 7 5v11M9 20v-5h6v5M9 11h2M13 11h2',
  library:   'M4 5h6a2 2 0 012 2v13a3 3 0 00-3-2H4zM20 5h-6a2 2 0 00-2 2v13a3 3 0 013-2h5z',
  backfield: 'M3 18h18M5 18V8M19 18V8M5 8h14M8 18v-4h8v4M12 5v3',
  musicroom: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM19 16a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  canteen:   'M4 4v7a3 3 0 003 3v6M7 4v6M10 4v6M17 4c-2 0-3 3-3 6s1 4 3 4v6',
  arcade:    'M7 12h4M9 10v4M15 11h.01M17 13h.01M4 8h16a1 1 0 011 1v7a3 3 0 01-3 3H6a3 3 0 01-3-3V9a1 1 0 011-1zM8 8V6a2 2 0 012-2h4a2 2 0 012 2v2',
  tutorschool:'M3 8l9-4 9 4-9 4zM7 11v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5M21 8v6',
  temple:    'M12 3l8 5H4zM6 8v9M10 8v9M14 8v9M18 8v9M3 17h18M4 21h16',
  home:      'M3 11l9-7 9 7M6 10v10h12V10M10 20v-6h4v6',
  assembly:  'M6 3v18M6 4h12l-3 4 3 4H6M4 21h6',
  shop:      'M4 7h16l-1.2 12H5.2zM9 7a3 3 0 016 0',
  exam:      'M7 3h10a1 1 0 011 1v16l-6-3-6 3V4a1 1 0 011-1zM10 8h4M10 12h4',
  music:     'M9 18V6l10-2v12M9 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM19 16a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  sport:     'M12 3a9 9 0 100 18 9 9 0 000-18zM12 3v18M3 12h18M6 6l12 12M18 6L6 18',
  academic:  'M4 5h11a2 2 0 012 2v13H6a2 2 0 01-2-2zM8 9h7M8 13h7M19 5v15',
  volunteer: 'M12 20s-7-4.5-7-9a4 4 0 017-2.5A4 4 0 0119 11c0 4.5-7 9-7 9z',
  // ภาคมหาลัย
  lecture:   'M3 6h18M4 6v12M20 6v12M3 18h18M7 10h10M7 13h7M9 3v3M15 3v3',
  unilib:    'M3 4h7v16H3zM14 4h7v16h-7zM5 8h3M5 12h3M16 8h3M16 12h3M12 4v16',
  faccant:   'M3 5v6a3 3 0 003 3v5M6 5v6M9 5v6M15 5c-1.5 0-2.5 2.5-2.5 5.5S14 15 15 15v4M18 5v14',
  parttime:  'M4 9h13v7a3 3 0 01-3 3H7a3 3 0 01-3-3zM17 11h2a2 2 0 010 4h-2M7 5c0-1 1-1 1-2M11 5c0-1 1-1 1-2',
  bar:       'M5 4h14l-6 7v7M13 18h4M9 18h4M8 7h8',
  clubroom:  'M4 6h16v10H4zM8 16v4M16 16v4M6 20h12M9 9v4M12 8v5M15 10v3',
  dorm:      'M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h2M14 10h2',
  barber:    'M6 5l12 12M18 5L6 17M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z',
};

export function icon(name: string, cls = ""): string {
  const d = P[name] ?? P.home;
  return `<svg class="ico-svg ${cls}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="${d}"/></svg>`;
}

export const hasIcon = (name: string) => name in P;
