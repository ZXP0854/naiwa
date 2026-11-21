# 奶蛙大学 · 学生信息管理系统（Java Servlet + JDBC 版）
# 镜像内置 Tomcat 9，启动时优先连 MySQL，连不上自动使用内置 H2，无需外部数据库即可运行
FROM tomcat:9.0-jdk17-temurin

ENV LANG=C.UTF-8 \
    CATALINA_OPTS="-Dfile.encoding=UTF-8 -Duser.timezone=Asia/Shanghai" \
    NAIWA_H2_PATH=/tmp/naiwa

RUN rm -rf /usr/local/tomcat/webapps/*

WORKDIR /build

# 1) 编译 Servlet（Tomcat 镜像自带 JDK 与 servlet-api.jar）
COPY java/src ./src
COPY java/web/WEB-INF/web.xml ./WEB-INF/web.xml
RUN mkdir -p WEB-INF/classes WEB-INF/classes/data WEB-INF/lib \
    && javac -encoding UTF-8 -cp /usr/local/tomcat/lib/servlet-api.jar -d WEB-INF/classes $(find src -name "*.java") \
    && rm -rf src

# 2) 依赖与数据
COPY java/lib/*.jar WEB-INF/lib/
COPY data/seed_students.json data/majors.json WEB-INF/classes/data/

# 3) 静态页面
COPY index.html majors.html college.html students.html anthem.html admin.html _shot.html ./
COPY css ./css
COPY js ./js
COPY assets ./assets

# 4) 以 ROOT 上下文部署，访问根路径即为首页
RUN mkdir -p /usr/local/tomcat/webapps/ROOT \
    && cp -r /build/. /usr/local/tomcat/webapps/ROOT/

COPY java/docker-entrypoint.sh /usr/local/bin/naiwa-entrypoint.sh
RUN chmod +x /usr/local/bin/naiwa-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/naiwa-entrypoint.sh"]
