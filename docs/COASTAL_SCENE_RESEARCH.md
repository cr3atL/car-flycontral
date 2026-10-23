# 滨海立交场景参考与构建方法

本轮先研究再构建。采用已确认的概念预览；下面资料用于构建方法，不作为新的玩法要求。

## 教程与技能

- [The CG Essentials：沿曲线构建道路与高架](https://blender.fi/2021/04/22/how-to-model-a-road-or-highway-along-a-path-in-blender/)：教程说明包括道路截面、曲线、阵列顺序、桥墩沿路重复。已阅读公开说明与章节，未把文字阅读声称为完整观看视频。应用为同一中心线驱动路面、标线、护栏和桥墩。
- [Blender Curve Modifier](https://docs.blender.org/manual/en/4.4/modeling/modifiers/deform/curve.html)：确认沿路径变形的原理。最新手册抓取失败，搜索索引可读旧版说明；实际5.2接口以连接的Blender运行结果为准。
- [Environment Artist SKILL.md](https://github.com/arjun988/blender-skills/blob/main/.claude/skills/environment-artist/SKILL.md)，MIT：已阅读技能及 modular-kits、composition 参考。借鉴模块复用、道路引导线、前中远景层次和沿玩家视角复查。没有安装未知脚本、插件或更改全局技能目录。
- [Anvil Level Design技能](https://github.com/reason-machines/design-skills/blob/main/skills/anvil-level-design-blender/SKILL.md)：已评估，其流程依赖额外编辑器插件；本轮现有Blender MCP足够，不安装该插件。
- 本地 concept-art 技能沿用前轮已读取的构图、3D基础和可建造性方法。已确认的单一预览优先于其通用多方案流程。

## 场景决策

可驾驶道路优先于摆景。中心线采样为凸四边形，GLB视觉顶点与JSON碰撞多边形同源；曲面接缝逐面核对。起飞口、高架入口不放横栏。补气条带处于宽路面行驶路径。断桥恢复路与沿岸绕行均真实连接。桥墩避开恢复驾驶通道。

中景保留车辆尺度的灯杆、混凝土桥墩与护栏；远景建筑用低复杂度轮廓。海面和海岸提供高度参照。弯道外侧设施帮助读方向，接收区保持视觉干净。导出后还需实际游戏相机复查，鸟瞰图不代表可玩性通过。

## 免费资源

[Asphalt 031 / ambientCG](https://ambientcg.com/view?id=Asphalt031)，[官方CC0许可](https://docs.ambientcg.com/license/)：允许修改、分发并用于游戏。用户明确允许合适的免费共用资源，已下载官方1K JPG包。使用其颜色与法线贴图，压至512尺寸后嵌入GLB；原包保留在本地源目录，发布资产不依赖第三方在线站点。

下载源：https://ambientcg.com/get?file=Asphalt031_1K-JPG.zip

原包SHA256：f98114b8fb083fc65925c3b4568b131e37c9a23357d432a16e59676dbc69f964。

Poly Haven亦已核对官方CC0许可，但本轮未下载其百万三角面的海岸模型。海岸、桥梁及设施采用本场景自建几何，避免引入与当前规模不匹配的大型扫描资产。

研究和资源许可信息不进入游戏HUD。
