# 赤隼 · CRIMSON LIFT

Babylon.js 飞行汽车游戏。当前独立片段《停车场不让你走》：飞过倾斜停车架，空中补气，重压黄板弹飞清洁车，砸墙放下真实维修桥，再驶出停车场。原90秒挑战、连续三段和自由练习保留，连续三轴、补气、24/30米限高、评分与落地力度保持。

PC HUD按地面、特技、准备落地和接地入账切换；前路提示贴实际障碍，预计朝向用车形与真实点连线，完成后可直接再来。完整键位可在主菜单“操作”或暂停查看。手机用同样四状态，右上最多两条动作；左下转向/平转，右下滚翻，独立小推进键在右区上方。设置可折叠调整布局并恢复默认。主菜单以停车场片段为主入口，声音与效果收进设置；90秒结算在右侧展开等级、总分和三项统计，其他数据可展开查看。

## 开始玩

[在线试玩](https://cr3atl.github.io/car-flycontral/) · [源码仓库](https://github.com/cr3atL/car-flycontral)

打开[生产预览 localhost:4173](http://localhost:4173/)，选择“停车场不让你走”。起步向右选宽道并提前松开转向，黄区按住空格约1秒，以画面的继续推进/释放提示调整；之后松手，落黄板开路。中线可在释放推进后轻按Q贴合斜架。手机先左区选线，释放后用独立推进；右区滚翻与左区yaw仍可组合。轻落后沿维修回环在架后再起飞，R则整段重开。

“90秒挑战”仍可直接进入。前20秒先飞、短按感受转动、再按住体验持续旋转；后续障碍已提前构建，可在接地时看见下一组。基础路线按黄区提示：车阵点按，错列约0.55秒，断桥约0.8秒，低桥和闸点按，最终组合约0.55秒。可选环未拿到也能安全完成。

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

本地最终候选 `index-BJJYocJ2.js`，SHA256 `7f336f7bee01486d1bd286cda4e6d64d5fb749bec83a1f51426200bba3278e92`，相对路径构建。137项全量单元测试通过，最终8顶点OBB比较等8项专项另行通过。9项浏览器检查通过，最终生产PC中线、667/844原生触屏均完成机关闭环、出口后25米完成、重试与菜单。

轻落本地回环、启动时暂停和开路后撞毁保持成功均有原速输入证据。固定步长诊断与原生试玩分列，首轮失败记录保留。旧操控240采样精确一致。运行时、测试与重放100项已冻结；主控负责独立验收、提交和发布。

- [停车场机关实现与验证](docs/PARKING_ESCAPE_IMPLEMENTATION.md)
- [验证索引](docs/parking-validation.json)与[最终冻结清单](docs/parking-runtime-freeze.json)

上版Bqv的[部署记录](https://github.com/cr3atL/car-flycontral/actions/runs/39788378120)及历史交付见下列文档。

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
