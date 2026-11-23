import type { Metadata } from 'next';
import GameClient from './game-client';

export const metadata: Metadata = {
  title: '游戏盒 · 页游门户 · LibreTV',
  description: '4399 风格网页游戏门户：江湖风云录（第四章·余烬 / 经脉锻造 / 连招 Boss）、三国杀、保卫萝卜等页游专区，即开即玩',
};

export default function GamePage() {
  return <GameClient />;
}
