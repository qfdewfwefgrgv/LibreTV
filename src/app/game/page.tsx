import type { Metadata } from 'next';
import GameClient from './game-client';

export const metadata: Metadata = {
  title: '游戏 · LibreTV',
  description: '三国杀单机、消消乐、五子棋、跑酷等网页小游戏合集',
};

export default function GamePage() {
  return <GameClient />;
}
