# 龙娘桌宠 Live2D

Windows 白紫色 Q 版龙娘桌宠，使用真实 Live2D Cubism 模型，可连接 OpenAI API 进行文字聊天。

![角色预览](live2d/preview/idle.png)

## 功能

- 正面模型：33 个绘制网格、36 个模型参数和 4096×4096 纹理图集。
- 左右独立侧身模型：各 7 个网格、8 个参数；侧身走路、距离同步步频、减速后转向。
- 下蹲、侧坐、侧撑、侧躺蜷睡及起身；蜷睡带轻微呼吸起伏。
- 膝盖屈伸、手臂关节、身体重心、翅膀、尾巴，以及头发和衣裙物理。
- 待机、走路、招手、开心、小跳、睡觉、醒来、伸懒腰、张望、点头、摊手与整理裙摆。
- 沿桌面底边自由走动，拖动后平滑落地，也可关闭贴底自由摆放。
- 托盘和角色右键菜单，支持置顶、窗口大小调整及返回右下角。
- GPT 聊天、模型名称配置和回复取消；密钥使用 Windows DPAPI 在本机加密。

动作由运行程序实时驱动 Cubism 参数，并使用逐关节弹簧平滑衔接；当前没有另存为独立 `.motion3.json` 动作文件。

## 安装使用

当前版本为 **v1.05**（程序内部版本号 `1.0.5`）。从 [v1.05 下载页](https://github.com/shAdom666/--chatgpt/releases/tag/v1.05) 下载 `GPTDragonPet-1.05-portable-x64.zip`，完整解压后双击 `GPTPet.exe`。运行包自带 Electron 和模型，不需要安装 Cubism 或 Node.js。改动见 [CHANGELOG.md](CHANGELOG.md)。

目标环境为 Windows 10 2004+/Windows 11 的 x64 兼容系统，需 .NET Framework 4.8 或更新版本。便携版可解压到自己选择的文件夹；退出程序后删除该文件夹即可移除。此前的安装版仍可通过 Windows“已安装的应用”卸载。更新保留本机 GPT 连接设置，没有设置开机自启。

单击角色打开聊天，按住拖动，右键选择动作及设置。新动作是“蹲下”“侧躺蜷睡”“起身”。睡觉时选择其他动作，会先起身。“日常小动作”控制空闲时随机做动作。“贴住屏幕底边”关闭后可以自由摆放。

## 连接 GPT

在聊天窗口的“连接设置”中填写自己的 OpenAI API Key 和有权限使用的模型名称。保存设置不会调用 API，发送消息时才会连接。

- API 用量由你自己的 API 账户计费。
- 密钥保存在 `%LOCALAPPDATA%\GPTDesktopPet\settings.json`，使用 Windows DPAPI 加密；也支持 `OPENAI_API_KEY` 进程环境变量。
- 密钥和个人设置不包含在仓库或安装包中，更新及卸载保留本机设置。
- 请求发送到 OpenAI Responses API，使用 `store=false`，最多携带最近十轮对话。
- 聊天记录只在本次窗口内存中保存。程序不读取屏幕、摄像头或麦克风，也不执行回复中的命令。

## 从源码运行

准备 Git、Git LFS、Node.js/npm，以及 .NET Framework 4.8。以下命令在项目根目录的 PowerShell 中执行：

```powershell
git clone https://github.com/shAdom666/--chatgpt.git
Set-Location -LiteralPath '.\--chatgpt'
git lfs install
git lfs pull
npm ci --prefix live2d/runtime
powershell -NoProfile -File build-live2d.ps1
powershell -NoProfile -File build.ps1
.\GPTPet.exe
```

`GPTPet.exe` 启动 Electron 程序，`GptBridge.exe` 负责本机设置和 API 请求。
`live2d/runtime/vendor/live2dcubismcore.min.js` 已包含运行用 Cubism Core；无需下载编辑器。

## 验证

不调用 API 的基础检查：

```powershell
npm ci --prefix live2d/tools
node tests/live2d-walk.cjs
node tests/natural-motion.cjs
node tests/sideview-motion.cjs
node tests/sideview-authoring.cjs
node tests/posture-motion.cjs
node live2d/tools/validate-model.mjs
powershell -NoProfile -File tests/run-multiview.ps1
powershell -NoProfile -File live2d/tools/check-runtime.ps1 -Mode multiview
powershell -NoProfile -File live2d/tools/check-runtime.ps1 -Mode placement
powershell -NoProfile -File live2d/tools/check-runtime.ps1 -Mode rig
powershell -NoProfile -File live2d/tools/check-runtime.ps1 -Mode animation
node tests/live2d-fullbody.cjs
powershell -NoProfile -File live2d/tools/check-runtime.ps1 -Mode showcase
node tests/natural-showcase.cjs
```

动作与移动单元检查覆盖 30/60/120/144/240 Hz。渲染检查使用真实 Cubism 网格、物理和可见像素；报告在本机生成，不提交个人运行日志。

## 编辑模型

- 当前可编辑工程：`live2d/model/GPTDragon.natural.cmo3`，通过 Git LFS 保存。
- 分层 PSD：`live2d/source/GPTDragon.layers.psd`。
- 图层、底图及拆分数据：`live2d/source/`。
- 运行入口：`live2d/model/GPTDragon.model3.json`。
- 动作控制：`live2d/runtime/motions.js`。
- 模型制作记录：`live2d/制作进度.txt`、`live2d/修复记录.txt`。

编辑 `.cmo3` 需要自行安装、授权 Live2D Cubism Editor。仓库不包含编辑器、试用授权或其他开发工具安装程序。
重新导出当前模型后运行 `node live2d/tools/finalize-model.mjs` 与模型检查脚本。

工程生成脚本参考 StretchyStudio。若需从分层源图重建初始工程，可将该项目的提交 `24a83a27ba43e43e9d2e3de5e33994594e6199c2` 检出到 `third_party/stretchystudio`，再安装 `live2d/tools` 的依赖。`build-project.mjs` 会生成初始工程；`refine-mouth.py`、`repair-fullbody.py`、`add-knee-rig.py` 依赖各阶段的中间工程，不能直接对最终工程重复执行。历史中间工程未上传，当前最终工程可直接打开编辑。

## 构建安装包

准备 Inno Setup 7 编译器，执行：

```powershell
powershell -NoProfile -File build-installer.ps1 -CompilerPath "你的 Inno Setup 目录\ISCC.exe"
```

安装包、SHA-256 和构建报告输出到 `dist/`。详见 [安装包构建说明](installer/README.md)。安装包采用明确的文件清单，不打包密钥、编辑器、源码工程或缓存。

## 后续更新

`main` 保留可运行的版本，功能改动建议在分支开发并通过相关检查后合并。第一版使用标签 `v1.0.0`，后续更新按实际改动增加版本号，并在 Releases 附上对应安装包及 SHA-256。
涉及用户设置的变更应保留原有密钥和配置；不要将本机设置、运行日志或开发工具加入提交。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `src/` | C# 启动器、GPT 连接组件及保留的早期 WPF 实现 |
| `live2d/runtime/` | Electron 窗口、聊天界面与动作控制 |
| `live2d/model/` | 当前模型、物理、纹理与可编辑工程 |
| `live2d/source/` | 分层素材与 PSD |
| `live2d/preview/` | 实际模型渲染的动作预览 |
| `live2d/tools/` | 工程处理和检查工具 |
| `installer/` | 安装向导与许可说明 |
| `tests/` | 移动、动作、渲染和安装验证 |

## 素材与组件许可

这是个人同人项目，与 OpenAI 或 Live2D 无官方关联。公开仓库不表示所有内容采用同一种开源许可证。

角色依据用户提供的参考图进行重绘和拆层。原有美术素材的作者署名及非商业使用要求见 [assets/NOTICE.md](assets/NOTICE.md)，请勿将这些素材视为可自由商用。当前尚未为自编代码另行指定统一开源许可证。

- [StretchyStudio](https://github.com/MangoLion/stretchystudio)：MIT，工程生成参考，许可随仓库保留。
- PixiJS 与 Pixi Live2D Display：MIT。
- Electron：MIT，Chromium 及其他组件保留各自许可。
- Live2D Cubism Core：遵循 Live2D 专有软件许可，副本位于 `installer/licenses/`，运行文件保留版权声明。

安装包中的组件许可保存在 `licenses/` 和 Electron 运行目录，详见 [第三方组件说明](installer/THIRD-PARTY-NOTICES.txt)。
