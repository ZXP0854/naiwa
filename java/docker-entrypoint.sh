#!/bin/sh
# 云平台会通过 PORT 环境变量指定监听端口，这里同步到 Tomcat 的 Connector
set -e

PORT="${PORT:-8080}"
sed -i "s/Connector port=\"8080\"/Connector port=\"${PORT}\"/" /usr/local/tomcat/conf/server.xml

mkdir -p "${NAIWA_H2_PATH:-/tmp/naiwa}"

exec /usr/local/tomcat/bin/catalina.sh run
