import { SPRITES } from './sprites/pieceSprites';
import { PieceSprite } from './pixelPieces';

// react-chessboard `customPieces` map: { wP: ({ squareWidth }) => <svg/>, ... }
export const pixelPieces = Object.fromEntries(
  Object.keys(SPRITES).map((code) => [
    code,
    ({ squareWidth }) => <PieceSprite code={code} size={squareWidth} animated />,
  ])
);
