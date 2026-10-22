# 当前验证 连续三段强速度候选

2026-10-22，最终生产 `index-C-F0B5ZY.js`。菜单“连续三段”提供车阵、真实断桥与可选高环、有限桥架和直道释放；一跳对照及90秒玩法保留。

74项规则/物理/布局检查、其后5项视觉边界分别通过，主控独立复核；最终4个浏览器用例通过。PC键盘、844×390和667×375普通CDP双拇指均原速三段全精准、三次电驱、环实补30、零撞毁、14340入账，实际峰速约152.62km/h。每段留有152–153km/h原图，气流层中央透明及HUD保护有像素检查。

失误/离地/重开清理、微量与零补给、非精准不领电驱、旧一跳隔离、暂停与20轮资源复用均有记录。667早期grade1失败保留，证实名义1050ms被采集延为1.283/1.342秒；测试先release后取样，修正为明确1100ms计划与真实每轴时间，等级阈值未改。

主控最终独立构建前后38项无差异，产物SHA256 `4c4be13aa938c53c78433829339a6a0cb952236f3d9256145c39cbb408cd7351`。生产扫描无开发入口，两个端口均200；独立生产页普通输入三次精准、真实补30、最终4980、空error/warn。

- [实现、调整后的布局与失败说明](SPRINT_IMPLEMENTATION.md)
- [最终证据摘要](sprint-validation.json)、[36项源冻结](sprint-runtime-freeze.json)、[主控独立生产验收](sprint-supervisor-final.json)
- [PC原速](sprint-native-1280.json)、[844双拇指](sprint-native-844.json)、[667双拇指](sprint-native-667.json)
- [固定步进四路线](sprint-routes.json)、[暂停与20轮资源](sprint-visual-lifecycle.json)

本轮没有卡顿专项；对象数有界不代表帧率通过。桌面触控模拟和主控审图不代表手机真机/iOS或热负载。音频工具检查不等于人耳听验；最终强度不代称用户已满意。末段约6秒收尾作为后续可调节奏保留。

旧一跳基线见[ONE_JUMP_EXPERIENCE.md](ONE_JUMP_EXPERIENCE.md)，连续操控历史验收见[CONTINUOUS_ACCEPTANCE.md](CONTINUOUS_ACCEPTANCE.md)。旧测试数和旧冻结只属于各自版本。CORE_ACCEPTANCE始终由主控维护，开发未编辑。
