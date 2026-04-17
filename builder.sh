# npm install
# npm run build
docker buildx build -f docker/dockerfile --target release --network host \
	--build-arg http_proxy=http://127.0.0.1:7890 \
	--build-arg https_proxy=http://127.0.0.1:7890 \
	-t uptime-kuma-mcc20 .
docker image prune -f
