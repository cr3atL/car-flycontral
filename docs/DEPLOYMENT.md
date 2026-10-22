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

仓库保留源码、设计文档、最终冻结/验收摘要与选定阶段截图。较大的逐帧原始记录和失败原件留在本地 `docs/`，没有上传；文件未被删除。主控本轮覆盖及边界见 [CORE_ACCEPTANCE.md](CORE_ACCEPTANCE.md) 第十一、十二轮。

GitHub 说明：[Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 首次发布验收（2026-10-22）

[构建与部署均成功](https://github.com/cr3atL/car-flycontral/actions/runs/39745605901)，游戏提交为 `02eb356226cc8e0c7e5da5c3235ae19cbf790346`。线上首页、图标、脚本、样式和全部 59 个资源均HTTP200；线上主脚本SHA与本地主控最终构建一致。主控在GitHub Pages普通UI实玩自由练习：推进1秒、DQW同时1.1秒、松手，完成三轴、真实补气、精准接地+4680，控制台error/warn为空。该项是线上一跳冒烟检查，完整90秒验收在本地版本进行，范围见主控验收记录。

## PC HUD更新（2026-10-22）

[云端检查、构建与部署成功](https://github.com/cr3atL/car-flycontral/actions/runs/39765545025)，游戏提交 `1ec63d238cbbb84347a30945c978177a09ca6612`。最终包 `index-BjoQz9Zg.js`，SHA256 `87c2138066b566d0f43f25ee0cc5a4b7504f7a740fbd6d480661594dbed189f3`。主控独立111项全部通过、74项源码与测试冻结匹配；此前BDD候选实际完整90秒9/9、零修复，最终Bjo针对方向、真实点和危险用词复验通过。

线上首页及全部59项静态资源HTTP200，主脚本SHA匹配本地构建。线上普通操作推进1秒→DQW1.1秒→松手，实际精准入账4680、总4780，鼠标重试回0并可返回菜单，控制台无错误/警告。线上仅做本项冒烟检查，不称线上重跑完整90秒。
