import type { Metadata } from 'next';
import GithubClient from './github-client';

export const metadata: Metadata = {
  title: 'GitHub 榜单 · 每周热榜 / 历史最热 / 最实用',
  description:
    '每周自动更新的 GitHub 榜单：本周热门项目、历史 star 最高项目、最实用的自托管工具，全部中文翻译，并提供一键部署入口。',
};

export default function GithubRankPage() {
  return <GithubClient />;
}
