import { PIECE_CODES } from './pieceSkins.js';
import { PieceSprite } from './pixelPieces';

// react-chessboard `customPieces` map: { wP: ({ squareWidth }) => <svg/>, ... }
export const pixelPieces = Object.fromEntries(
  PIECE_CODES.map((code) => [
    code,
    ({ squareWidth }) => <PieceSprite code={code} size={squareWidth} animated />,
  ])
);
