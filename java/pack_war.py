# -*- coding: utf-8 -*-
"""把暂存目录打包成 war（条目使用正斜杠，避免反斜杠导致 Tomcat 解包异常）"""
import os
import sys
import zipfile

src, out = sys.argv[1], sys.argv[2]
if os.path.exists(out):
    os.remove(out)

entries = 0
webinf = []
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, src).replace(os.sep, "/")
            z.write(full, rel)
            entries += 1
            if rel.startswith("WEB-INF"):
                webinf.append(rel)

print("packed entries:", entries, "size MB:", round(os.path.getsize(out) / 1048576, 2))
print("WEB-INF:", webinf)
if not any(x.endswith(".class") for x in webinf):
    print("WARNING: no .class in WEB-INF/classes")
