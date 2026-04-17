docker stop uptime-kuma
docker rm uptime-kuma
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v /root/workspace/uptime-kuma/data:/app/data \
  -v /etc/hosts:/etc/hosts:ro \
  --restart unless-stopped \
  uptime-kuma-mcc20
