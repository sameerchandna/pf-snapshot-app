import React, { createContext, useContext } from 'react';

export type ScreenPalette = {
  bg: string;
  accent: string;
  sectionHeaderBg: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
};

export const palettes = {
  snapshot:   { bg: '#e7f5ff', accent: '#1971c2', sectionHeaderBg: '#a5d8ff', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  projection: { bg: '#f8f1ee', accent: '#f08c00', sectionHeaderBg: '#ffec99', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  entry:      { bg: '#f8f0fc', accent: '#9c36b5', sectionHeaderBg: '#eebefa', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  whatIf:     { bg: '#ebfbee', accent: '#2f9e44', sectionHeaderBg: '#b2f2bb', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
  settings:   { bg: '#e9ecef', accent: '#868e96', sectionHeaderBg: '#e9ecef', cardBg: '#ffffff', cardBorder: '#1e1e1e', text: '#1e1e1e', textSecondary: '#868e96' },
} as const;

const ScreenPaletteContext = createContext<ScreenPalette>(palettes.snapshot);

export const ScreenPaletteProvider = ScreenPaletteContext.Provider;

export function useScreenPalette(): ScreenPalette {
  return useContext(ScreenPaletteContext);
}
