# 赤隼 · CRIMSON LIFT

Babylon.js 飞行汽车游戏。当前90秒挑战已重组为连续施工组合：车阵、错列双障碍、断桥补气、有限低桥、开放表演、升降闸和最终组合。精准落地按真实姿态、方向、每轴转速和接近速度判定；预计落点明确表示松手后的趋势。连续三段冲刺、自由练习与三模式共享的强喷气/补气/速度反馈保留。

PC HUD按地面、特技、准备落地和接地入账切换；前路提示贴实际障碍，预计朝向用车形与真实点连线，完成后可直接再来。完整键位可在暂停查看，手机沿用触控布局。

## 开始玩

[在线试玩](https://cr3atl.github.io/car-flycontral/) · [源码仓库](https://github.com/cr3atL/car-flycontral)

打开[生产预览 localhost:4173](http://localhost:4173/)，选择“开始90秒挑战”。前20秒先飞、短按感受转动、再按住体验持续旋转；后续障碍已提前构建，可在接地时看见下一组。基础路线按黄区提示：车阵点按，错列约0.55秒，断桥约0.8秒，低桥和闸点按，最终组合约0.55秒。可选环未拿到也能安全完成。

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

普通双拇指先推进、松开推进，再操作左右两区。按住多久转多久，允许直接反向与同时三轴；没有自动整圈或动作队列。主表100，真实腾空补给上限60，动作20/10/5，环请求30；实际量受双上限约束。独立缓冲与用户认可的约0.41米落地曲线保留。

## 当前交付

生产包 `index-BjoQz9Zg.js`，SHA256 `87c2138066b566d0f43f25ee0cc5a4b7504f7a740fbd6d480661594dbed189f3`，相对路径构建。HUD/计分相关18项单测、5项浏览器检查通过；主控独立全量111/111通过。主控独立构建已匹配74项运行时/测试文件。

运行时与测试已冻结。主控已普通UI验收四状态、失误、重试及BDD候选完整90秒9/9、2700、零修复。最终版本的真实投影点、旧撞毁结果和无地面用词边界也已由主控实际复验，页面无异常；原始失败及版本范围保留。GitHub Pages已更新，线上实际三轴→精准4680入账→总4780及鼠标重试通过。

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
