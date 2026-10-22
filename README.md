# 赤隼 · CRIMSON LIFT

Babylon.js 单人喷气跑车原型，支持PC和手机横屏。当前新核心为Roadster：手动驾驶、持续抬升、空中前推与侧推、反推制动，在道路和不同高度的平台之间选择通往出口的路线。

[在线驾驶](https://cr3atl.github.io/car-flycontral/roadster.html) · [源码仓库](https://github.com/cr3atL/car-flycontral) · [原型设计](docs/ROADSTER_CORE_PROTOTYPE.md)

[本轮Pages构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39829688053)，线上主包和Blender场景已与验收构建核对，主控线上实际直跨通关。

## 开始驾驶

从首页选择Roadster，或直接打开 `roadster.html`。推荐先直线加速、在断口前短喷跨到对岸，接地后继续驶过绿色出口。随后尝试低平台的两次起降，以及高平台的主动爬升与顺势滑落。

可以停车看路、倒车调整，也能在空中改变落点。松开喷气后保留惯性并受重力下落。反推只减水平速度；看到下降预警时点喷缓冲。气压在稳定接地且所有喷气停止后恢复，平台中部的青色补气区域恢复更快。

| 操作 | PC | 手机横屏 |
| --- | --- | --- |
| 油门和空中前推 | W | 左摇杆向前 |
| 地面方向和空中侧推 | A / D | 左摇杆左右 |
| 刹车和空中反推 | S | 左摇杆向后 |
| 持续抬升 | 按住空格 | 按住右侧喷气 |
| 暂停 | Esc | 暂停按钮 |
| 最近安全位置复位 | R | 暂停内复位 |

停稳后松开制动，再次后推才倒车。手机摇杆两个轴独立，斜推和喷气可以同时使用；松手、取消触点、暂停、切后台和转屏都会清除输入。整场重开在暂停菜单中。

本模式没有自动前进、独立三轴特技或90秒限制。得分规则后续设计，当前不产生分数或评级。旧版停车场、90秒挑战、连续三段和自由练习通过“旧版试验场”保留。

## 场地与验证

场地使用Blender MCP构建，GLB与布局数据共同定义9块道路、平台和回程坡道。低平台高4米，高平台高10米，下层道路可地面驶回起点。导出顶点已逐块核对，碰撞与预测沿用同源布局。

- [Blender构建说明与预览](docs/ROADSTER_BLENDER_SCENE.md)
- [Blender源文件](assets/blender/roadster-lab.blend) · [构建脚本](assets/blender/build_roadster_lab.py)
- [主控验收记录](docs/CORE_ACCEPTANCE.md) · [实际人工试玩范围](docs/roadster-supervisor-play.json)

主控独立规则检查155项通过。原生键盘和多触点路线记录、人工试玩、固定步长诊断分别记录；浏览器触屏模拟不代表实体手机结果。具体候选、重复次数与发布状态以本轮验收和部署记录为准。

## 本地开发

```sh
npm ci
npm run dev
npm test
npm run build -- --base=./
npm run preview
```

开发入口为 [127.0.0.1:5173/roadster.html](http://127.0.0.1:5173/roadster.html)，生产预览为 [127.0.0.1:4173/roadster.html](http://127.0.0.1:4173/roadster.html)。Windows受限环境可先设置 `$env:NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main'`。

`src/roadster/` 包含独立输入、运动、预测、呈现和声音。`public/assets/roadster-lab-layout.json` 是场地几何契约，`roadster-lab.glb` 为实际显示资产。修改场地时同时更新Blender源和布局，再运行 `node scripts/audit-roadster-blender.mjs` 核对二进制顶点。

推送main后由GitHub Actions执行锁定依赖安装、规则检查、相对路径构建和Pages部署，见 [部署说明](docs/DEPLOYMENT.md)。开发调试接口仅出现在开发构建。

## 历史原型

旧规则与记录保留在 [原始设计](docs/GAME_DESIGN.md)、[停车场机关](docs/PARKING_ESCAPE_IMPLEMENTATION.md)、[连续操控](docs/CONTINUOUS_CONTROL.md)、[PC HUD](docs/PC_HUD_IMPLEMENTATION.md)、[手机HUD](docs/MOBILE_HUD_IMPLEMENTATION.md) 和 [菜单结算](docs/MENU_RESULTS_IMPLEMENTATION.md)。这些模式保持各自规则，与新Roadster模式分开。
