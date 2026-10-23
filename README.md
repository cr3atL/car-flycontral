# 赤隼 · CRIMSON LIFT

Babylon.js 单人喷气跑车原型，支持PC和手机横屏。当前场地为滨海立交试驾区：手动驾驶、短喷跨桥、抬升切入高架、反推落台，再接下坡驶出出口。沿岸普通道路和下层恢复路线均可驾驶。

[在线驾驶](https://cr3atl.github.io/car-flycontral/roadster.html) · [源码仓库](https://github.com/cr3atL/car-flycontral) · [本轮美术样段](docs/COASTAL_ART_SAMPLE.md)

首处跨桥新增Blender MCP制作的跑车、岩岸和植被，配合动态海面、暖色日光与阴影。地面持续按住制动可直接过渡到倒车；碰护栏会阻挡、减速或滑行，驶出地图才自动恢复。最终范围见[验收记录](docs/CORE_ACCEPTANCE.md)，发布结果见[本轮部署记录](docs/coastal-art-deployment.json)。

本轮[Pages部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39930857079)，线上相对路径包 `roadster-BAcCjqFS.js` 及全部213项静态资源已核对。主控普通线上PC和667布局均实际跨桥接地后续行，失败与重试分列保存。

## 开始驾驶

从首页选择Roadster，或直接打开 `roadster.html`。沿直道加速，在琥珀标线处短喷跨桥；落地后顺着缓弯进入检修区，低速抬升并向右修正，反推缩短落点，接地后沿高架下坡驶出。起飞前可以停车观察，也可以沿岸绕行。

可以停车看路、倒车调整，也能在空中改变落点。松开喷气后保留惯性并受重力下落。反推只减水平速度；看到下降预警时点喷缓冲。气压在稳定接地且所有喷气停止后恢复，平台中部的青色补气区域恢复更快。

| 操作 | PC | 手机横屏 |
| --- | --- | --- |
| 油门和空中前推 | W | 左摇杆向前 |
| 地面方向和空中侧推 | A / D | 左摇杆左右 |
| 刹车和空中反推 | S | 左摇杆向后 |
| 持续抬升 | 按住空格 | 按住右侧喷气 |
| 暂停 | Esc | 暂停按钮 |
| 最近安全位置复位 | R | 暂停内复位 |

持续按住S或向后推摇杆，车辆先刹停再倒车，无需松开重按。空中反推仍只把水平速度降到零。手机摇杆两个轴独立，斜推和喷气可以同时使用；松手、取消触点、暂停和转屏都会清除输入。切后台的清除接线已检查，真实系统后台行为尚待真机验证。整场重开在暂停菜单中。

本模式没有自动前进、独立三轴特技或90秒限制。得分规则后续设计，当前不产生分数或评级。旧版停车场、90秒挑战、连续三段和自由练习通过“旧版试验场”保留。

## 场地与验证

场景由Blender MCP初建；实时画面接口超时后的回程修复与预览在独立Blender源中完成，未覆盖其他项目。GLB与布局共同定义154块真实路面和182段护栏碰撞，主线断口24米，高架高8米，恢复道路低5米。最终凸性、顶点和接缝均已核对。许可明确的免费ambientCG沥青贴图已嵌入场景，来源见构建参考。

- [构建参考与免费资源](docs/COASTAL_SCENE_RESEARCH.md) · [实现说明](docs/COASTAL_IMPLEMENTATION.md)
- [Blender源文件](assets/blender/coastal-interchange.blend) · [构建脚本](assets/blender/build_coastal_interchange.py)
- [主控验收记录](docs/CORE_ACCEPTANCE.md) · [实际试玩范围](docs/coastal-supervisor-play.json)

本轮开发与主控独立全量检查均186项通过。最终同包PC、667、844原生输入主线通过；主控另以普通游戏输入验证PC和667布局的跨桥、落地续行，及倒车、碰栏退出和出界恢复。只读状态反馈自动控制与主控普通UI试玩分列，失败尝试保留。真机、新玩家上手研究、主观音频和性能专项未验证。

新增资产可从[样段源文件说明](assets/blender/FIRSTSPAN_SOURCES.txt)重建；[跑车](assets/blender/roadster-gt.blend)和[海岸](assets/blender/firstspan-coast.blend)均可独立打开编辑。新增外部资源仅为CC0的[Poly Haven天空HDR](assets/third-party/polyhaven-kloppenheim06/README.md)。

## 本地开发

```sh
npm ci
npm run dev
npm test
npm run build -- --base=./
npm run preview
```

开发入口为 [localhost:5173/roadster.html](http://localhost:5173/roadster.html)，生产预览为 [localhost:4173/roadster.html](http://localhost:4173/roadster.html)。Windows受限环境可先设置 `$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'`。

`src/roadster/` 包含独立输入、运动、预测、呈现和声音。`public/assets/coastal-interchange-layout.json` 是场地几何契约，`coastal-interchange.glb` 为实际显示资产。修改场地时同时更新Blender源和布局，再运行 `node scripts/audit-coastal-blender.mjs` 核对凸性与二进制顶点。

推送main后由GitHub Actions执行锁定依赖安装、规则检查、相对路径构建和Pages部署，见 [部署说明](docs/DEPLOYMENT.md)。开发推进接口仅在开发构建；显式 `?qa=1` 的生产观察入口只返回状态深拷贝，普通入口关闭。

## 历史原型

旧规则与记录保留在 [原始设计](docs/GAME_DESIGN.md)、[停车场机关](docs/PARKING_ESCAPE_IMPLEMENTATION.md)、[连续操控](docs/CONTINUOUS_CONTROL.md)、[PC HUD](docs/PC_HUD_IMPLEMENTATION.md)、[手机HUD](docs/MOBILE_HUD_IMPLEMENTATION.md) 和 [菜单结算](docs/MENU_RESULTS_IMPLEMENTATION.md)。这些模式保持各自规则，与新Roadster模式分开。
