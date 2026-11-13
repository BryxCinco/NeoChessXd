import { createContext } from 'react';
import { DEFAULT_PIECE_SKIN } from './pieceSkins.js';

// The piece skin chosen in SETTINGS. App provides it once; every sprite
// (board, captured trays, menus, countdown) follows it.
export const PieceSkinContext = createContext(DEFAULT_PIECE_SKIN);
