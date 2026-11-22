export type DeployType = 'docker' | 'vercel' | 'docs';

export interface DeployInfo {
  type: DeployType;
  label: string;
  cmd?: string;
  url?: string;
}

export interface RepoItem {
  full_name: string;
  name: string;
  owner: string;
  html_url: string;
  description: string;
  description_zh: string;
  translated: boolean;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  homepage: string | null;
  avatar: string;
  created_at?: string;
  pushed_at?: string;
  weekStars?: number;
  category?: string;
  deploy?: DeployInfo;
  install?: string;
}

export interface GithubRankData {
  updatedAt: string;
  translator: 'qwen' | 'none';
  weekly: RepoItem[];
  allTime: RepoItem[];
  practical: RepoItem[];
}

export interface GithubRankResponse {
  ok: boolean;
  building: boolean;
  stale: boolean;
  data?: GithubRankData;
  error?: string;
}
