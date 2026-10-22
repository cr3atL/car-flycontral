# 赤隼 · CRIMSON LIFT

Babylon.js 飞行汽车游戏。当前90秒挑战已重组为连续施工组合：车阵、错列双障碍、断桥补气、有限低桥、开放表演、升降闸和最终组合。精准落地按真实姿态、方向、每轴转速和接近速度判定；预计落点明确表示松手后的趋势。连续三段冲刺、自由练习与三模式共享的强喷气/补气/速度反馈保留。

PC HUD按地面、特技、准备落地和接地入账切换；前路提示贴实际障碍，预计朝向用车形与真实点连线，完成后可直接再来。完整键位可在主菜单“操作”或暂停查看。手机用同样四状态，右上最多两条动作；左下转向/平转，右下滚翻，独立小推进键在右区上方。设置可折叠调整布局并恢复默认。主菜单以90秒挑战为主入口，声音与效果收进设置；90秒结算在右侧展开等级、总分和三项统计，其他数据可展开查看。

## 开始玩

[在线试玩](https://cr3atl.github.io/car-flycontral/) · [源码仓库](https://github.com/cr3atL/car-flycontral)

打开[生产预览 localhost:4173](http://localhost:4173/)，选择“90秒挑战”。前20秒先飞、短按感受转动、再按住体验持续旋转；后续障碍已提前构建，可在接地时看见下一组。基础路线按黄区提示：车阵点按，错列约0.55秒，断桥约0.8秒，低桥和闸点按，最终组合约0.55秒。可选环未拿到也能安全完成。

断桥表演可用推进约1.1秒→松推进、DQW约1.1秒→松手约0.15秒→推进约0.4秒→松推进、DQW约1秒→全松手收势。普通双拇指先释放推进，再左区平转、右区斜拖滚/翻。接续中留出制动和落地时间。

青色预计趋势可精准，黄色仍需调整，缺口有红色断裂落点指示和“无安全地面”。精准阈值为倾斜18°、方向25°、每轴0.6rad/s、接近速度4.6m/s；命中落地区单列，不另加分。实际没精准会显示真实主因。

“连续三段”仍按约0.5/0.8/0.5秒推进，精准接地后顺势冲出；“自由练习”保留施工车阵的一跳体验。练习与三段可按R重试；90秒可在暂停菜单重新开始。已有页面需要重载取得新版。

## 操作

| 行为 | PC | 手机横屏 |
| --- | --- | --- |
| 地面转向 | A/D、左右箭头 | 左区两侧按住或拖动 |
| 空中平转 yaw | A/D、左右箭头 | 左区两侧按住或拖动 |
| 侧滚 roll | 按住Q/E | 右区左右拖动保持 |
| 前后翻 pitch | 按住W/S | 右区上下拖动保持 |
| 组合 | 多轴一起按住 | 左区平转，右区斜拖滚/翻 |
| 推进 | 空格，继续按住持续施力 | 右下推进键 |
| 收势 | 松开旋转键 | 回中或松手 |
| 暂停 | Esc、右上按钮 | 右上按钮 |

普通双拇指先推进、松开推进，再操作左右两区。按住多久转多久，允许直接反向与同时三轴；没有自动整圈或动作队列。主表100，真实腾空补给上限60，动作20/10/5，环请求30；实际量受双上限约束。独立缓冲与约0.41米落地曲线保留。离地24米以下原轨迹精确保持，24—30米渐进抑制主升力与上升惯性，随后自然回落；旋转和下降缓冲独立。被抑制的持续推进不扣气，短喷对应份额退回主表并单独记账。

## 当前交付

已发布至 GitHub Pages 的最终包 `index-BqvO1ECL.js`，SHA256 `c48f82b2216dab849fefff22aaf4a396f45749d8e160f9ad878d67e7424bb754`，相对路径构建。主控独立129项检查、相对构建通过，88项源码/测试/重放冻结匹配；开发11项浏览器检查已审阅。主控实际667手机HUD完成90秒3140分、8/9、1次修复；最终包一跳完整入账与菜单返回已复验。

最终生产包667最大布局和844默认布局均用原生双指完成三轴：精准入账4680、总4780，bank完整后结束区接替，重试和菜单正常。16个布局几何角点在真实两行动作、bank、结束区共48组边界框无交叠。低空360采样精确一致；合法固定步长90秒9/9与三段高环完成，和原速输入证据分别保存。首轮旧300米断言及布局交叠失败记录保留。

[本轮部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39788378120)，线上59资源与主包哈希已核对；667横屏三轴入账和29.8米高度提示/自然回落已实际复验。

上一版C53的[部署记录](https://github.com/cr3atL/car-flycontral/actions/runs/39777427418)与菜单结算验收见以下历史交付文档。

- [手机操作与限高实现](docs/MOBILE_HUD_IMPLEMENTATION.md)
- [本轮验证索引](docs/mobile-hud-validation.json)与[最终冻结清单](docs/mobile-hud-runtime-freeze.json)
- [菜单与结算实现和验证](docs/MENU_RESULTS_IMPLEMENTATION.md)
- [菜单与结算验证索引](docs/menu-results-validation.json)与[最终冻结清单](docs/menu-results-runtime-freeze.json)
- [PC HUD实现与四状态原图](docs/PC_HUD_IMPLEMENTATION.md)
- [HUD验证摘要](docs/pc-hud-validation.json)与[运行时/测试冻结](docs/pc-hud-runtime-freeze.json)
- [90秒路线与实际按法](docs/CHALLENGE_FLOW_IMPLEMENTATION.md)、[路线验证基线](docs/challenge-flow-validation.json)
- [共享呈现](docs/SHARED_EFFECTS_IMPLEMENTATION.md)、[三段布局](docs/SPRINT_IMPLEMENTATION.md)、[连续操控](docs/CONTINUOUS_CONTROL.md)

## 本地开发

~~~powershell
npm ci
npm run dev
npm test
npm run test:sprint
npm run test:shared
npm run test:flow
npm run test:hud
node scripts/sprint-scenario.mjs
npm run build -- --base=./
npm run preview
~~~

[开发版 localhost:5173](http://localhost:5173/)，[生产预览 localhost:4173](http://localhost:4173/)。Windows受限环境可先设置 `$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'`。使用本机Edge，不自动安装浏览器。未改本机防火墙；GitHub Pages发布静态生产构建，仅开发构建提供调试入口。

历史单圈/强制顺序/预付12点约定已由连续操控替代。此前一跳61项/8用例和控制基线52项/23用例作为历史保留，不冒充本轮结果。
