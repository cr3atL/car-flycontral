# GitHub Pages 部署

目标账号为 `cr3atL`，源码仓库为 [car-flycontral](https://github.com/cr3atL/car-flycontral)。游戏入口为 [GitHub Pages](https://cr3atl.github.io/car-flycontral/)。实际发布状态以仓库 Actions 和在线页面为准。

推送到 `main` 会运行 `.github/workflows/pages.yml`：Node.js 22、`npm ci`、`npm test`、`npm run build -- --base=./`，检查通过才上传静态产物并部署 Pages。相对资源路径支持仓库子目录及 Babylon.js 动态着色器模块。

本地检查：

```sh
npm ci
npm test
npm run build -- --base=./
npm run preview
```

浏览器原速检查另外运行，需要本地开发服务与 Microsoft Edge：

```sh
npm run dev
npm run test:flow
```

仓库保留源码、设计文档、最终冻结/验收摘要与选定阶段截图。早期较大的逐帧原件保留在本地；停车场本轮的原生输入、失败记录与阶段图随提交保存，范围由各轮验证索引说明。主控本轮覆盖及边界见 [CORE_ACCEPTANCE.md](CORE_ACCEPTANCE.md) 第十一、十二轮。

GitHub 说明：[Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 首次发布验收（2026-10-22）

[构建与部署均成功](https://github.com/cr3atL/car-flycontral/actions/runs/39745605901)，游戏提交为 `02eb356226cc8e0c7e5da5c3235ae19cbf790346`。线上首页、图标、脚本、样式和全部 59 个资源均HTTP200；线上主脚本SHA与本地主控最终构建一致。主控在GitHub Pages普通UI实玩自由练习：推进1秒、DQW同时1.1秒、松手，完成三轴、真实补气、精准接地+4680，控制台error/warn为空。该项是线上一跳冒烟检查，完整90秒验收在本地版本进行，范围见主控验收记录。

## PC HUD更新（2026-10-22）

[云端检查、构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39765545025)，游戏提交 `1ec63d238cbbb84347a30945c978177a09ca6612`。最终包 `index-BjoQz9Zg.js`，SHA256 `87c2138066b566d0f43f25ee0cc5a4b7504f7a740fbd6d480661594dbed189f3`。主控独立111项全部通过、74项源码与测试冻结匹配；此前BDD候选实际完整90秒9/9、零修复，最终Bjo针对方向、真实点和危险用词复验通过。

线上首页及全部59项静态资源HTTP200，主脚本SHA匹配本地构建。线上普通操作推进1秒→DQW1.1秒→松手，实际精准入账4680、总4780，鼠标重试回0并可返回菜单，控制台无错误/警告。线上仅做本项冒烟检查，不称线上重跑完整90秒。

## 主菜单与结算更新（2026-10-22）

[检查、构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39777427418)，游戏提交 `ebda0fb15adc9ad9bca96bcf65dcc4b2560d94a4`。最终包 `index-C53q8ie3.js`，SHA256 `fa6025f2d251c39ce0e244412bafa973d520a52dcd76817f27492a4d2d2ac873`。主控独立120项检查通过；79项运行/测试冻结和21项玩法保护全部匹配。

主控本地普通输入完成90秒真实结算2600分、8/9、零修复，及连续三段3/3；最终生产包针对三轴入账与菜单返回复验。线上首页及59静态资源HTTP200，主包SHA匹配本地构建；线上普通三轴一跳精准+4680、总4780，完整入账后结束区正常，重试归零、返回菜单与操作弹窗均正常，无错误/警告。无历史记录时线上最佳隐藏。详细版本与实际试玩范围见CORE_ACCEPTANCE第十三轮和menu-results-deployment.json，不把固定步长纪录/手机图诊断称为原生试玩。

## 手机HUD与24/30米限高更新（2026-10-22）

[检查、构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39788378120)，游戏提交 `ada8fee36187d25e2c004eab34ed059e2adf8f1c`。最终包 `index-BqvO1ECL.js`，SHA256 `c48f82b2216dab849fefff22aaf4a396f45749d8e160f9ad878d67e7424bb754`。主控独立129项检查通过，相对构建与88项冻结匹配；低空360采样与旧版完全一致。

主控本地手机HUD原速90秒3140分、8/9、1次修复；最终生产667一跳精准4680。开发最终667最大/844默认原生CDP双指各4780，和48组布局边界诊断已分开审阅，不代表实体手机。线上首页/59静态资源HTTP200、主包SHA一致；主控线上667横屏用屏幕推进与键盘三轴完成精准4680/总4780，另推进2秒到DOM29.8米显示高度上限并自然回落，一跳完成。重试、菜单和浏览器尺寸恢复正常，无错误/警告。线上只做两条一跳冒烟，完整90秒在本地Dg候选，最终Bq显示修订后做针对复验。详见CORE_ACCEPTANCE第十四轮和mobile-hud-deployment.json。


## 停车场机关逃脱更新（2026-10-22）

[检查、构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39807619243)，游戏提交 `0beee2178966ec6b349bea3d0f426148fdf5b22a`。主入口为“停车场不让你走”，无总倒计时，包含穿架补气、重压弹车、破墙开桥与出口。三轴、气压、限高、原计分与落地力度保持。

独立137项全量及冻结后8项专项通过，240采样对照一致；最终PC/667/844生产原生证据绑定BJJY。主包 `index-BJJYocJ2.js` SHA256 `7f336f7bee01486d1bd286cda4e6d64d5fb749bec83a1f51426200bba3278e92`，1425453字节，线上与独立构建精确一致。首页及60资源全部200；60非index资源字节全同，index仅CR/LF差异，去CR后相同。

主控线上667原生键盘选宽路加屏幕推进，首跳未开路后按架后维修提示推进700ms，实际重压开路、过桥到出口；无大0或门柱遮挡，重试wall恢复closed、菜单正常、控制台error/warn空，视口已reset。不是线上一跳零失误或实体手机验证。详见[发布证据](parking-deployment.json)与[本轮验收](CORE_ACCEPTANCE.md)。


## Roadster新核心原型更新（2026-10-23）

[云端构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39829688053)，代码提交454afb94e0707ba47ab9dce2f446127a2351e8e3。推送后未自动启动，使用既有Pages工作流手动dispatch，未修改发布权限或配置。新入口为 [Roadster](https://cr3atl.github.io/car-flycontral/roadster.html)，首页也可选择Roadster，旧模式独立保留。

独立155项规则检查通过、385项冻结匹配。PC和两种手机模拟尺寸三路线各3次原生自动输入完成，共27次；这些是只读状态辅助控制，不代表人工新手研究。主控另有实际键鼠试玩，详细范围见CORE_ACCEPTANCE第十六轮。

主包roadster-28PJ6-kN.js，683836字节，SHA256 f3f848e4d83f6132d258e97bf431740fad488a1a40fbe67b8f12bab73098b35d。159线上资源HTTP200，157项字节精确一致；index与布局JSON仅换行差异，布局数据深度一致，Blender场景二进制字节相同。

线上实际普通键盘连续完成直跨、喷气、反推、far接地和出口；667屏幕控件实际升空、刹停、暂停与菜单复验，控制台无错误/警告。线上只做上述冒烟，实体手机和新玩家仍未验证。详情见 [发布记录](roadster-deployment.json)。
