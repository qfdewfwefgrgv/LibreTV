#!/usr/bin/env bash
# 在阿里云服务器上执行：更新 /opt/libretv 并重建 libretv 容器
# 用法：
#   1) 若源码已同步到 /opt/libretv：  bash /opt/libretv/scripts/deploy-aliyun.sh
#   2) 若从上传包解压：              bash deploy-aliyun.sh /path/to/extracted

set -euo pipefail

TARGET="${1:-/opt/libretv}"
cd "$TARGET"

echo "===== 目录: $(pwd) ====="
ls -la docker-compose.yml Dockerfile src/components/jianghu.tsx public/space/orbit/index.html 2>/dev/null || true

if [ ! -f docker-compose.yml ]; then
  echo "ERROR: 找不到 docker-compose.yml，请确认路径: $TARGET"
  exit 1
fi

# ORBIT 体积大，确认已就位
if [ -f public/space/orbit/index.html ]; then
  sz=$(wc -c < public/space/orbit/index.html)
  echo "ORBIT index.html = $sz bytes"
else
  echo "WARN: 缺少 public/space/orbit/index.html（探索宇宙 ORBIT 章将 404）"
fi

echo "===== docker compose build & up ====="
docker compose up -d --build

echo "===== 容器状态 ====="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | head -20

echo "===== 冒烟 ====="
sleep 3
curl -s -o /dev/null -w "home %{http_code}\n" http://127.0.0.1:8080/ || true
curl -s -o /dev/null -w "space %{http_code}\n" http://127.0.0.1:8080/space || true
curl -s -o /dev/null -w "game %{http_code}\n" http://127.0.0.1:8080/game || true
curl -s -o /dev/null -w "orbit %{http_code}\n" http://127.0.0.1:8080/space/orbit/index.html || true

echo "===== DEPLOY_DONE ====="
echo "浏览器打开: https://dianying.online/space  与  https://dianying.online/game"
