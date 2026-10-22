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

仓库保留源码、设计文档、最终冻结/验收摘要与选定阶段截图。较大的逐帧原始记录和失败原件留在本地 `docs/`，没有上传；文件未被删除。主控本轮覆盖及边界见 [CORE_ACCEPTANCE.md](CORE_ACCEPTANCE.md) 第十一轮。

GitHub 说明：[Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
