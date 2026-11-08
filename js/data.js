/* ============================================================
 * 奶蛙大学 · 全局数据
 * - 22 个学院、224 个专业（其中 24 个为补充专业，示例图未给出，
 *   形象借用同学院其他专业，文件名以"借用形象"字段记录）
 * - 种子学生生成器：确定性伪随机，首次运行写入 localStorage
 * ============================================================ */
(function () {
  "use strict";

  // majors: 示例图中实际出现的专业（形象已抠取，assets/majors/<学院>/<专业>.png）
  // sup:    补充专业（示例图未给全：经管第 1 页 15 个、工学院第 2 页 9 个）
  // supFirst: 补充专业是否排在前面（经管示例图是第 2 页，故补充在前）
  var COLLEGES = [
    { name: "医学院", majors: [
      "超声医学","傣医学","儿科学","耳鼻喉头颈外科学","法医学","放射医学","放射肿瘤学","妇幼保健与助产",
      "肛肠医学","公安法医","公共卫生","公共卫生管理","公共卫生与营养","骨科","护理学","基础医学",
      "急诊医学","健康管理","精神医学","康复技术","康复医学","康复治疗","口腔护理","口腔医学",
      "口腔医学技术","老年护理","临床医学","麻醉学","全科医学","神经外科","生物信息学","生物医学科学",
      "生物医学系","卫生检验与检疫技术","卫生信息管理","心内科","言语听觉康复","眼视光","眼视光医学","医美美容",
      "医学检验","医学检验技术","医学检验与实验","医学实验技术","医学营养学","医学影像技术","医学影像与核医学","幼儿保育",
      "预防医学","运动康复","针灸推拿","针灸与康复","智慧健康养老服务与管理","智能医学工程","中西医临床","中西医临床医学",
      "中药资源与开发","中医","中医骨伤科学","中医康复","中医康复学","中医养生保健","中医养生学","重症医学"
    ]},
    { name: "药学院", majors: [
      "海洋药学","临床药学","生物医药","生物制药","药剂学","药品经营与管理","药品生产技术","药事管理",
      "药物分析","药物化学","药物经济与管理","药物制剂","药学","制药工程","中药","中药制药"
    ]},
    { name: "新闻传播学院", majors: [
      "播音与主持","播音与主持艺术","广播影视节目制作","广告学","数媒技专业","数字媒体技术",
      "数字媒体艺术专业","网络营销与直播电商","网络与新媒体","戏剧影视文学","新闻学"
    ]},
    { name: "师范教育学院", majors: [
      "教育学","社会体育指导与管理","思想政治教育","特殊教育","小学教育","应用心理学","早期教育"
    ]},
    { name: "农学院", majors: [
      "草学","草业科学","宠物养护与训导","宠物医疗技术","宠物医疗与护理","畜牧兽医","动物医学",
      "果树专业","农业生物技术","水产学","现代农业","现代农业装备应用技术","种子科学与工程"
    ]},
    { name: "经济管理学院", supFirst: true, majors: [
      "经济统计学","经济学","酒店管理与数字化运营","老年保健与管理","旅游管理","农村金融","审计学",
      "市场营销","数字化运营","物流管理","现代家政服务与管理","现代物业管理专业","医疗保险","智慧健康养老服务与管理"
    ], sup: [
      "金融学","会计学","工商管理","财务管理","国际经济与贸易","人力资源管理","电子商务","大数据与会计",
      "工商企业管理","资产评估","投资学","互联网金融","跨境电子商务","连锁经营与管理","商务管理"
    ]},
    { name: "工学院", majors: [
      "电气工程及其自动化","工业机器人","供用电技术","光电信息工程","过程装备与控制工程","化学工程",
      "机电一体化","机器人工程","机械电子工程","机械工程"
    ], sup: [
      "机械设计与制造","数控技术","智能制造装备技术","电子信息工程技术","应用电子技术",
      "物联网应用技术","计算机网络技术","软件技术","人工智能技术应用"
    ]},
    { name: "艺术学院", majors: [
      "产品设计","服装表演","服装设计","家具设计与制作","建筑室内设计","美容美体与形象设计",
      "美容美妆专业","美术","视觉传达设计","室内艺术设计","无业游民"
    ]},
    { name: "法学院", majors: ["法律学","法学","国际政治","刑事科学技术","知识产权"] },
    { name: "外国语学院", majors: ["翻译","日语专业","商务英语","西班牙语","英语"] },
    { name: "文学院", majors: ["汉语国际","汉语言文学"] },
    { name: "历史学院", majors: ["考古学","文物保护与修复"] },
    { name: "理学院", majors: ["力学","数学专业","物理材料","应用化学","应用物理"] },
    { name: "地理学院", majors: ["地理科学专业"] },
    { name: "环境学院", majors: [
      "测绘地理信息技术","大气科学","环境工程技术","环境设计","水土保持","碳中和科学与工程"
    ]},
    { name: "汽车学院", majors: [
      "汽修","铁路机车与车辆","新能源汽车","新能源汽车检测与维修技术","智能网联汽车技术"
    ]},
    { name: "土木工程学院", majors: [
      "港口航道与海岸工程","工程测量技术","建筑学专业","排水科学工程","土木工程"
    ]},
    { name: "化学化工学院", majors: [
      "分析检验","高分子材料与工程","化学","化学工程与工艺","应用化学"
    ]},
    { name: "生命科学学院", majors: [
      "酿酒技术","生物工程","生物技术","生物统计学","细胞生物学"
    ]},
    { name: "食品学院", majors: [
      "食品检验检测技术","食品营养与健康","食品质量与安全","食品智能加工技术","中式面点","中西式面点"
    ]},
    { name: "航空服务学院", majors: ["空乘"] },
    { name: "体育学院", majors: ["乒乓球系"] }
  ];

  // 展开为 { name, majors: [{name, img, sup}] }；img 为形象文件名（不含扩展名）
  COLLEGES.forEach(function (c) {
    var real = c.majors.map(function (m) { return { name: m, img: m, sup: false }; });
    var sup = (c.sup || []).map(function (m, i) {
      return { name: m, img: c.majors[i % c.majors.length], sup: true };
    });
    c.majors = c.supFirst ? sup.concat(real) : real.concat(sup);
    delete c.sup;
    delete c.supFirst;
  });

  function collegeOf(name) {
    for (var i = 0; i < COLLEGES.length; i++) {
      if (COLLEGES[i].name === name) return COLLEGES[i];
    }
    return null;
  }

  function majorInfo(collegeName, majorName) {
    var c = collegeOf(collegeName);
    if (!c) return null;
    for (var i = 0; i < c.majors.length; i++) {
      if (c.majors[i].name === majorName) return c.majors[i];
    }
    return null;
  }

  function imgPath(collegeName, imgName) {
    return "assets/majors/" + encodeURIComponent(collegeName) + "/" + encodeURIComponent(imgName) + ".png";
  }

  /* ---------------- 种子学生（确定性伪随机） ---------------- */
  var SURNAMES = "王李张刘陈杨赵黄周吴徐孙马朱胡郭何林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董潘袁蔡蒋余杜叶程苏魏吕丁任卢".split("");
  var GIVEN = ["伟","芳","娜","敏","静","丽","强","磊","军","洋","勇","艳","杰","娟","涛","明","超","秀兰","霞","平",
    "刚","桂英","雨欣","子轩","浩然","梓涵","一诺","依诺","欣怡","诗涵","雨泽","沐宸","若汐","艺涵","若曦","思远",
    "嘉懿","煜城","鹤轩","博文","昊天","律恒","梦琪","忆柳","之桃","慕青","问兰","尔岚","元香","初夏","沛珊","傲珊"];
  var HOMETOWNS = ["北京市","天津市","上海市","重庆市","广东省广州市","广东省深圳市","四川省成都市","湖北省武汉市",
    "陕西省西安市","江苏省南京市","浙江省杭州市","山东省济南市","湖南省长沙市","福建省福州市","云南省昆明市","河南省郑州市"];
  var NOTES = ["", "", "", "", "", "班长", "学习委员", "团支书", "学生会成员", "三好学生", "社团骨干", ""];

  // LCG：同一种子永远生成同一批学生
  function lcg(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function genSeedStudents() {
    var rnd = lcg(20261024);
    var students = [];
    COLLEGES.forEach(function (c, ci) {
      c.majors.forEach(function (m, mi) {
        var n = 2 + (rnd() < 0.3 ? 1 : 0);
        for (var k = 0; k < n; k++) {
          var year = 2022 + Math.floor(rnd() * 4);          // 2022-2025 级
          var id = String(year) +
                   ("0" + (ci + 1)).slice(-2) +
                   ("0" + (mi + 1)).slice(-2) +
                   ("0" + (k + 1)).slice(-2);
          var name = SURNAMES[Math.floor(rnd() * SURNAMES.length)] +
                     GIVEN[Math.floor(rnd() * GIVEN.length)];
          students.push({
            id: id,
            name: name,
            gender: rnd() < 0.5 ? "男" : "女",
            college: c.name,
            major: m.name,
            className: m.name + (rnd() < 0.5 ? "1班" : "2班"),
            year: year,
            phone: "13" + Math.floor(rnd() * 10) + String(Math.floor(rnd() * 1e8)).padStart(8, "0"),
            email: id + "@mfu.edu.cn",
            hometown: HOMETOWNS[Math.floor(rnd() * HOMETOWNS.length)],
            note: NOTES[Math.floor(rnd() * NOTES.length)]
          });
        }
      });
    });
    return students;
  }

  window.NAIWA_DATA = {
    colleges: COLLEGES,
    collegeOf: collegeOf,
    majorInfo: majorInfo,
    imgPath: imgPath,
    genSeedStudents: genSeedStudents
  };
})();
