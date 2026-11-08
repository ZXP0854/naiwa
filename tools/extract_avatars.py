# -*- coding: utf-8 -*-
"""从示例图里自动检测专业卡片并抠出奶蛙形象（透明背景 PNG）。

两种页面：
1. 单学院分页（1-11.jpg）：专业有亮色卡片边框，亮度阈值 + 连通域得到卡片框；
2. 多学院合辑页（12-15.jpg）：专业没有卡片，且相邻奶蛙的影子会连成一团。
   改为先找"专业名标签"（红色文字小块，彼此分离稳定），再在标签上方区域里
   找最大深色团块作为该专业的奶蛙形象。
抠图统一用"从四边按底色泛洪"的方式，与桌宠待机图同一套思路。
"""
import os
import sys
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = r"E:\大三上\java web技术\期末作业\部分网页实例图片"
OUT_DIR = r"E:\大三上\java web技术\期末作业\assets\majors"
DEBUG_DIR = r"e:\大二下\心理学研究方法\vscode\temp_20261024_02\_cards_debug"

# 每张图：按阅读顺序（先行后列）列出 (学院, 专业)；None 表示只检测不导出
PAGES = {
    "1.jpg": ("医学院", ["超声医学","傣医学","儿科学","耳鼻喉头颈外科学","法医学","放射医学","放射肿瘤学","妇幼保健与助产","肛肠医学","公安法医","公共卫生","公共卫生管理","公共卫生与营养","骨科","护理学","基础医学"]),
    "2.jpg": ("医学院", ["急诊医学","健康管理","精神医学","康复技术","康复医学","康复治疗","口腔护理","口腔医学","口腔医学技术","老年护理","临床医学","麻醉学","全科医学","神经外科","生物信息学","生物医学科学"]),
    "3.jpg": ("医学院", ["生物医学系","卫生检验与检疫技术","卫生信息管理","心内科","言语听觉康复","眼视光","眼视光医学","医美美容","医学检验","医学检验技术","医学检验与实验","医学实验技术","医学营养学","医学影像技术","医学影像与核医学","幼儿保育"]),
    "4.jpg": ("医学院", ["预防医学","运动康复","针灸推拿","针灸与康复","智慧健康养老服务与管理","智能医学工程","中西医临床","中西医临床医学","中药资源与开发","中医","中医骨伤科学","中医康复","中医康复学","中医养生保健","中医养生学","重症医学"]),
    "5.jpg": ("药学院", ["海洋药学","临床药学","生物医药","生物制药","药剂学","药品经营与管理","药品生产技术","药事管理","药物分析","药物化学","药物经济与管理","药物制剂","药学","制药工程","中药","中药制药"]),
    "6.jpg": ("新闻传播学院", ["播音与主持","播音与主持艺术","广播影视节目制作","广告学","数媒技专业","数字媒体技术","数字媒体艺术专业","网络营销与直播电商","网络与新媒体","戏剧影视文学","新闻学"]),
    "7.jpg": ("师范教育学院", ["教育学","社会体育指导与管理","思想政治教育","特殊教育","小学教育","应用心理学","早期教育"]),
    "8.jpg": ("农学院", ["草学","草业科学","宠物养护与训导","宠物医疗技术","宠物医疗与护理","畜牧兽医","动物医学","果树专业","农业生物技术","水产学","现代农业","现代农业装备应用技术","种子科学与工程"]),
    "9.jpg": ("经济管理学院", ["经济统计学","经济学","酒店管理与数字化运营","老年保健与管理","旅游管理","农村金融","审计学","市场营销","数字化运营","物流管理","现代家政服务与管理","现代物业管理专业","医疗保险","智慧健康养老服务与管理"]),
    "10.jpg": ("工学院", ["电气工程及其自动化","工业机器人","供用电技术","光电信息工程","过程装备与控制工程","化学工程","机电一体化","机器人工程","机械电子工程","机械工程"]),
    "11.jpg": ("艺术学院", ["产品设计","服装表演","服装设计","家具设计与制作","建筑室内设计","美容美体与形象设计","美容美妆专业","美术","视觉传达设计","室内艺术设计","无业游民"]),
    "12.jpg": [("法学院", ["法律学","法学","国际政治","刑事科学技术","知识产权"]),
               ("外国语学院", ["翻译","日语专业","商务英语","西班牙语","英语"]),
               ("文学院", ["汉语国际","汉语言文学"]),
               ("历史学院", ["考古学","文物保护与修复"])],
    "13.jpg": [("理学院", ["力学","数学专业","物理材料","应用化学","应用物理"]),
               ("地理学院", ["地理科学专业"]),
               ("环境学院", ["测绘地理信息技术","大气科学","环境工程技术","环境设计","水土保持","碳中和科学与工程"])],
    "14.jpg": [("汽车学院", ["汽修","铁路机车与车辆","新能源汽车","新能源汽车检测与维修技术","智能网联汽车技术"]),
               ("土木工程学院", ["港口航道与海岸工程","工程测量技术","建筑学专业","排水科学工程","土木工程"]),
               ("化学化工学院", ["分析检验","高分子材料与工程","化学","化学工程与工艺","应用化学"])],
    "15.jpg": [("生命科学学院", ["酿酒技术","生物工程","生物技术","生物统计学","细胞生物学"]),
               ("食品学院", ["食品检验检测技术","食品营养与健康","食品质量与安全","食品智能加工技术","中式面点","中西式面点"]),
               ("航空服务学院", ["空乘"]),
               ("体育学院", ["乒乓球系"])],
}

# 合辑页分区（比例坐标）：(学院, x0, x1, y0, y1, 学院标题底边)
# x0/x1 为竖条范围，y0/y1 用于标签归属，title_bottom 是该分区学院标题的下沿
# （角色搜索区的上界不会越过它，避免把标题/页眉当成角色）。
COMBI_SECTIONS = {
    "12.jpg": [("法学院", 0.00, 0.50, 0.16, 0.52, 0.26),
               ("外国语学院", 0.50, 1.00, 0.16, 0.52, 0.26),
               ("文学院", 0.00, 0.50, 0.52, 0.93, 0.60),
               ("历史学院", 0.50, 1.00, 0.52, 0.93, 0.60)],
    "13.jpg": [("理学院", 0.00, 0.375, 0.16, 0.93, 0.26),
               ("地理学院", 0.375, 0.615, 0.16, 0.93, 0.26),
               ("环境学院", 0.615, 1.00, 0.16, 0.93, 0.26)],
    "14.jpg": [("汽车学院", 0.00, 0.365, 0.16, 0.93, 0.26),
               ("土木工程学院", 0.365, 0.62, 0.16, 0.93, 0.26),
               ("化学化工学院", 0.62, 1.00, 0.16, 0.93, 0.26)],
    "15.jpg": [("生命科学学院", 0.00, 0.50, 0.16, 0.52, 0.26),
               ("食品学院", 0.50, 1.00, 0.16, 0.52, 0.26),
               ("航空服务学院", 0.00, 0.50, 0.52, 0.93, 0.575),
               ("体育学院", 0.50, 1.00, 0.52, 0.93, 0.575)],
}


def page_luminance(img):
    """页面背景亮度 = 内容区亮度中位数（不能用四角：截图带黑边）。"""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    lum = a.mean(axis=2)
    content = lum[lum > 30]
    return lum, (float(np.median(content)) if content.size else 220.0)


def reading_order(boxes, h):
    """按 y 分行、行内按 x 排序（阅读顺序）。"""
    boxes = sorted(boxes, key=lambda b: b[1])
    rows = []
    for b in boxes:
        for row in rows:
            if abs(b[1] - row[0][1]) < h * 0.06:
                row.append(b)
                break
        else:
            rows.append([b])
    out = []
    for row in rows:
        row.sort(key=lambda b: b[0])
        out.extend(row)
    return out


def detect_cards(img, delta=4.0):
    """单学院页：亮度阈值 + 连通域，返回卡片框 [(x,y,w,h)]，按阅读顺序排序。"""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w = a.shape[:2]
    lum, page_lum = page_luminance(img)
    mask = lum > page_lum + delta
    mask[: int(h * 0.185), :] = False   # 排除顶部标题/按钮区
    mask[int(h * 0.895):, :] = False    # 排除底部标语/页码区
    # 开运算去噪、断开卡片之间的细桥
    mask = ndimage.binary_opening(mask, iterations=3)
    lab, n = ndimage.label(mask)
    boxes = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        ys, xs = sl
        bw, bh = xs.stop - xs.start, ys.stop - ys.start
        if bw < w * 0.025 or bh < h * 0.08:
            continue
        if bw > w * 0.6 or bh > h * 0.75:
            continue  # 大连通体（整片面板）丢弃
        # 填充率：卡片应大部分被填满
        fill = (lab[sl] == i).mean()
        if fill < 0.45:
            continue
        boxes.append((int(xs.start), int(ys.start), int(bw), int(bh)))
    return reading_order(boxes, h)


def detect_labels(img):
    """合辑页：找所有"专业名标签"候选（深色文字小块），返回 ([(x,y,w,h)], 页面亮度)。"""
    h, w = img.size[1], img.size[0]
    lum, pl = page_luminance(img)
    mask = lum < pl - 18.0
    mask[: int(h * 0.16), :] = False
    mask[int(h * 0.93):, :] = False
    mask = ndimage.binary_closing(mask, iterations=3)
    lab, n = ndimage.label(mask)
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        ys, xs = sl
        bw, bh = xs.stop - xs.start, ys.stop - ys.start
        if not (18 <= bh <= 60 and 35 <= bw <= 230):
            continue
        if float((lab[sl] == i).mean()) < 0.35:
            continue
        out.append((int(xs.start), int(ys.start), int(bw), int(bh)))
    # 合并同一标签被拆开的两行（上下相邻、水平重叠超过 60%）
    out.sort(key=lambda b: (b[0], b[1]))
    merged = True
    while merged:
        merged = False
        for i in range(len(out)):
            if merged:
                break
            x, y, bw, bh = out[i]
            for j in range(i + 1, len(out)):
                x2, y2, bw2, bh2 = out[j]
                overlap = min(x + bw, x2 + bw2) - max(x, x2)
                if overlap < 0.6 * min(bw, bw2):
                    continue
                if -5 <= y2 - (y + bh) <= 12:
                    nx, ny = min(x, x2), min(y, y2)
                    out[i] = (nx, ny, max(x + bw, x2 + bw2) - nx, max(y + bh, y2 + bh2) - ny)
                    out.pop(j)
                    merged = True
                    break
    return out, pl


def extract_char(img, pl, region):
    """在区域内找最大深色团块（即该标签对应的奶蛙），返回全图坐标包围盒与面积。"""
    x0, y0, x1, y1 = [int(v) for v in region]
    lum, _ = page_luminance(img)
    sub = lum[y0:y1, x0:x1]
    if sub.size == 0:
        return None, 0
    mask = sub < pl - 18.0
    mask = ndimage.binary_closing(mask, iterations=9)
    lab, n = ndimage.label(mask)
    best, best_area = None, 0
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        area = int((lab[sl] == i).sum())
        if area > best_area:
            ys, xs = sl
            best_area = area
            best = (x0 + int(xs.start), y0 + int(ys.start),
                    x0 + int(xs.stop), y0 + int(ys.stop))
    return best, best_area


def combi_pairs(fname, img, spec):
    """合辑页：以标签为锚点配对角色，返回 [((学院, 专业), (x,y,w,h))]；失败返回 None。"""
    w, h = img.size
    labels, pl = detect_labels(img)
    pairs = []
    ok = True
    for college, x0, x1, y0, y1, tb in COMBI_SECTIONS[fname]:
        sx0, sx1 = x0 * w, x1 * w
        sy0, sy1 = y0 * h, y1 * h
        tb_abs = tb * h
        # 标签归属：中心点落在分区矩形内，且顶边在学院标题之下
        inside = [b for b in labels
                  if sx0 <= b[0] + b[2] / 2 < sx1
                  and sy0 <= b[1] + b[3] / 2 < sy1
                  and b[1] > tb_abs]
        # 行聚类：按顶边分组（容差 30px，兼容一行/两行标签混排）
        inside.sort(key=lambda b: b[1])
        rows = []
        for b in inside:
            for row in rows:
                if abs(b[1] - row[0][1]) <= 30:
                    row.append(b)
                    break
            else:
                rows.append([b])
        majors = next(ms for c, ms in spec if c == college)
        # 多余的行只可能是最下方的标语残片，从下面删
        while rows and sum(len(r) for r in rows) > len(majors):
            rows.pop()
        if sum(len(r) for r in rows) != len(majors):
            print("  !! %s %s：标签 %d / 专业 %d" %
                  (fname, college, sum(len(r) for r in rows), len(majors)))
            ok = False
            continue
        mi = 0
        prev_bottom = None
        for row in rows:
            row.sort(key=lambda b: b[0])
            n_in_row = len(row)
            for j, (x, y, bw, bh) in enumerate(row):
                cx = x + bw / 2.0
                # 左/右边界：有邻居取标签中点（防止相邻奶蛙串扰），
                # 行首/行尾给一个保底半宽（单标签行更宽，防止大形象被裁）
                edge_half = 200 if n_in_row == 1 else max(bw / 2 + 40, 130)
                if j > 0:
                    left = (row[j - 1][0] + row[j - 1][2] / 2.0 + cx) / 2.0
                else:
                    left = max(sx0, cx - edge_half)
                if j < n_in_row - 1:
                    ncx = row[j + 1][0] + row[j + 1][2] / 2.0
                    right = (cx + ncx) / 2.0
                else:
                    right = min(sx1, cx + edge_half)
                # 上边界：不越过学院标题；非首行不越过上一行标签底
                top = tb_abs + 6
                if prev_bottom is not None:
                    top = max(top, prev_bottom + 10)
                else:
                    top = max(top, y - 640)  # 兼容个别特别高的形象（地理学院）
                bottom = y - 4
                box, area = extract_char(img, pl, (left, top, right, bottom))
                if box is None or area < 3000:
                    print("  !! %s %s《%s》未找到角色（面积 %d）" %
                          (fname, college, majors[mi], area))
                    ok = False
                else:
                    bx0, by0, bx1, by1 = box
                    pairs.append(((college, majors[mi]), (bx0, by0, bx1 - bx0, by1 - by0)))
                mi += 1
            prev_bottom = max(b[1] + b[3] for b in row)
    return pairs if ok else None


def trim_label_band(crop, pl):
    """卡片裁片：长专业名是两行标签，16% 裁带不够会留残字。
    在裁片下半段的行投影里找"下方仍有内容"的最末空隙，从空隙顶再裁一刀。"""
    a = np.asarray(crop.convert("RGB")).astype(np.float32)
    lum = a.mean(axis=2)
    dark = lum < pl - 18.0
    h, w = dark.shape
    rows = dark.sum(axis=1)
    thresh = max(2.0, w * 0.02)
    best = -1
    run, start = 0, -1
    for i in range(int(h * 0.55), h):
        if rows[i] <= thresh:
            if run == 0:
                start = i
            run += 1
        else:
            if run >= 5 and rows[i:].sum() > w * 0.5:
                best = start
            run = 0
    if run >= 5 and rows[h - 1] <= thresh:
        pass  # 末尾是空白，不算
    if best > 0:
        return crop.crop((0, 0, w, best))
    return crop


def cutout(card_img, thresh=42):
    """从四边按底色泛洪，返回透明背景 RGBA。"""
    im = card_img.convert("RGB")
    a = np.asarray(im).astype(np.int32)
    h, w = a.shape[:2]
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]], axis=0)
    bg = np.median(border, axis=0)
    dist = np.abs(a - bg).sum(axis=2)
    cand = dist < thresh
    region = np.zeros((h, w), bool)
    region[0, :] = cand[0, :]
    region[-1, :] = cand[-1, :]
    region[:, 0] = cand[:, 0]
    region[:, -1] = cand[:, -1]
    region &= cand
    prev = -1
    while region.sum() != prev:
        prev = region.sum()
        region = ndimage.binary_dilation(region) & cand
    alpha = np.where(region, 0, 255).astype(np.uint8)
    # 轻微羽化边缘
    soft = ndimage.gaussian_filter(alpha.astype(np.float32), 1.1)
    alpha = np.clip(soft * 1.6, 0, 255).astype(np.uint8)
    out = im.convert("RGBA")
    out.putalpha(Image.fromarray(alpha))
    return out


def save_debug(img, boxes, fname):
    dbg = img.copy().convert("RGB")
    d = ImageDraw.Draw(dbg)
    for i, (x, y, bw, bh) in enumerate(boxes):
        d.rectangle([x, y, x + bw, y + bh], outline=(255, 0, 0), width=4)
        d.text((x + 4, y + 4), str(i), fill=(255, 0, 0))
    dbg.save(os.path.join(DEBUG_DIR, fname.replace(".jpg", "_boxes.png")))


def main():
    os.makedirs(DEBUG_DIR, exist_ok=True)
    total = 0
    for fname, spec in PAGES.items():
        img = Image.open(os.path.join(SRC, fname))
        if isinstance(spec, tuple):
            # 单学院分页：卡片检测
            flat = [(spec[0], m) for m in spec[1]]
            boxes = detect_cards(img)
            print("%s  卡片 %d / 专业 %d  %s" %
                  (fname, len(boxes), len(flat), "OK" if len(boxes) == len(flat) else "!! 数量不符"))
            if len(boxes) != len(flat):
                save_debug(img, boxes, fname)
                continue
            # 卡片框内含底部专业名标签带，裁掉约 16%
            pairs = []
            for (college, major), (x, y, bw, bh) in zip(flat, boxes):
                pad = int(min(bw, bh) * 0.03)
                label_h = int(bh * 0.16)
                pairs.append(((college, major),
                              (x + pad, y + pad, bw - 2 * pad, bh - label_h - pad)))
        else:
            # 多学院合辑页：标签锚点检测
            pairs = combi_pairs(fname, img, spec)
            n_major = sum(len(ms) for _, ms in spec)
            print("%s  合辑形象 %s / 专业 %d  %s" %
                  (fname, len(pairs) if pairs else 0, n_major,
                   "OK" if pairs and len(pairs) == n_major else "!! 失败"))
            if not pairs:
                save_debug(img, [], fname)
                continue
            save_debug(img, [b for _, b in pairs], fname)
        for (college, major), (x, y, bw, bh) in pairs:
            pad = 4
            x0 = max(0, x - pad)
            y0 = max(0, y - pad)
            crop = img.crop((x0, y0, min(img.size[0], x + bw + pad), min(img.size[1], y + bh + pad)))
            if isinstance(spec, tuple) and len(major) >= 7:
                # 长名专业的标签是两行，按行投影空隙补裁
                _, pl = page_luminance(img)
                crop = trim_label_band(crop, pl)
            cut = cutout(crop)
            bb = cut.getbbox()
            if bb:
                cut = cut.crop(bb)
            cdir = os.path.join(OUT_DIR, college)
            os.makedirs(cdir, exist_ok=True)
            cut.save(os.path.join(cdir, major + ".png"))
            total += 1
    print("共导出 %d 张奶蛙形象 -> %s" % (total, OUT_DIR))


if __name__ == "__main__":
    main()
