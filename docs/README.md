# LibreTV 部署文档（本地补充）

本目录收录本项目自部署过程中沉淀的补充文档。

> **注意**：这些文档是本机部署实践的记录，**不属于上游官方文档**。
> 上游 README 与官方 wiki（架构 / 部署 / 配置 / 数据源 / 播放器等）见 <https://libretv.is-an.org/wiki/>。

## 文档索引

| 文档 | 适用场景 | 内容概要 |
| --- | --- | --- |
| [libretv-lan-https-guide.md](./libretv-lan-https-guide.md) | 需要从手机 / 电视 / 平板等局域网设备访问，并且希望走 HTTPS | 在 Windows 主机上用 Caddy 或 Nginx 终结 TLS；含 mkcert 证书签发与各终端信任、防火墙收口、验证清单与排错表 |

## 快速跳转

`libretv-lan-https-guide.md` 章节：

1. [为什么局域网也需要 HTTPS](./libretv-lan-https-guide.md#1-为什么局域网也需要-https)
2. [部署前准备](./libretv-lan-https-guide.md#2-部署前准备)
3. [用 mkcert 签发受信证书](./libretv-lan-https-guide.md#3-用-mkcert-签发受信证书)
4. [方案一：Caddy 反向代理](./libretv-lan-https-guide.md#4-方案一caddy-反向代理)
5. [方案二：Nginx for Windows](./libretv-lan-https-guide.md#5-方案二nginx-for-windows)
6. [防火墙与网络收口](./libretv-lan-https-guide.md#6-防火墙与网络收口)
7. [验证清单与排错](./libretv-lan-https-guide.md#7-验证清单与排错)
8. [环境变量与安全速查](./libretv-lan-https-guide.md#8-环境变量与安全速查)

## 本机部署现状

- **部署方式**：源码本地运行，`npm run build` 后用 `npm start` 启动（Next.js 生产模式，端口 8080）。
- **版本核对**：`curl http://127.0.0.1:8080/api/status` 返回的 `version` 字段应与 `package.json` 一致。
- **访问密码**：由根目录 `.env` 的 `PASSWORD` 提供；该文件已在 `.gitignore` 中，**不要提交到仓库**。
- **一键启停**：根目录的 `start-libretv.ps1` / `stop-libretv.ps1`（可由桌面快捷方式调用）。

## 阅读顺序建议

1. 先只在本机跑通：`npm run build` → `npm start` → 浏览器访问 `http://localhost:8080`。
2. 需要局域网其他设备访问时，按 [libretv-lan-https-guide.md](./libretv-lan-https-guide.md) 配置反向代理，**不要长期直接把 8080 暴露在局域网**。
3. 站点本身不内置任何影视源，首次使用需在「设置 → 源管理」里自行添加点播源（Apple CMS 采集接口）或直播源。

## 维护说明

- 文档中的示例 IP（`192.168.1.48`）、证书路径（`C:\libretv-proxy`）、主机名（`libretv.home.arpa`）均为示例，实际部署时按环境替换。
- 更换主机 IP、反向代理方案或端口后，请同步更新对应文档中的示例，避免照着过期参数操作。
