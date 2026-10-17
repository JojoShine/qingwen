# 参与贡献

欢迎通过 [Issues](https://github.com/JojoShine/qingwen/issues) 反馈问题或提出功能建议，通过 Pull Request 提交改进。

## 开发准备

按 [README](README.md#本地开发) 配置 Node.js、pnpm 和 PostgreSQL。请使用独立的开发或测试数据库，不要用生产数据运行自动化测试。

1. Fork 仓库并创建分支。
2. 保持修改聚焦；涉及界面请附桌面或移动截图，修复问题时说明复现步骤。
3. 执行 `pnpm test`、`pnpm typecheck` 和 `pnpm build`；涉及接口或操作流程时，按 README 执行对应集成或浏览器测试。
4. 提交 PR，描述问题、变化和验证结果；数据库结构变更需附新的 Prisma 迁移，不修改已经发布的历史迁移。

不要提交 `.env`、访问令牌、真实问卷/答卷、数据库备份或包含个人信息的截图。提交的贡献采用本项目的 [MIT 许可证](LICENSE)，请确保有权贡献相关代码和素材。
