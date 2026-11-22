import type { Metadata } from 'next';
import ComicClient from './comic-client';

export const metadata: Metadata = {
  title: '漫画 · LibreTV',
  description: '偷星九月天、斗破苍穹、斗罗大陆、知音漫客经典等漫画内嵌阅读',
};

export default function ComicPage() {
  return <ComicClient />;
}
