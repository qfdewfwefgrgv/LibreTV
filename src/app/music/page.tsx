import type { Metadata } from 'next';
import MusicClient from './music-client';

export const metadata: Metadata = {
  title: '音乐 · LibreTV',
  description: '汽水音乐 / QQ 音乐 / 酷狗音乐 / 网易云音乐 / Spotify / Apple Music 等主流音乐平台网页版入口',
};

export default function MusicPage() {
  return <MusicClient />;
}
