# 多视角与姿势素材

## v1.1 正面对齐、手臂与起卧修复

当前运行入口已改为 `../model/front-repair/GPTDragon-front.moc3` 与 `../model/postures-repair/GPTDragon-postures.model3.json`。旧 v1.05 文件保留用于比较；以下旧版说明描述的是发布时的实现。

正面修复工程包含 34 个网格、39 个参数，新增手腕和站姿下蹲准备参数。颈部与衣服共用躯干旋转；衣领、腰线接触点固定，裙内衬位于腿后方。双臂各有 9 个肘角 × 3 个手腕角的原生网格形变，运行时手臂动作拥有唯一控制来源。

新姿态顺序：半蹲、深蹲、手掌撑地、侧坐、肘部支撑、侧撑、侧躺蜷睡。`ParamPose` 只接收整数，`ParamTransition` 驱动相邻姿态的原生变形，`ParamPostureBreath` 保留呼吸。站姿由 `ParamCrouchPrepare` 向首个姿态的交接位置变形。整角色透明度始终为 0 或 1，起身时逆序经过支撑姿态；这消除了整角色交叉混合造成的双重轮廓。关键姿态的服装细节仍会在交接处切换，未实现卧姿全部关节独立控制。

新增原始图保存在 `front-repair/*-raw.png`、`postures/reach.png`、`postures/elbow.png`。正面沿用原角色材质，并补绘无头发碎片的独立手臂、无肢体残留的前裙与完整内衬；素材通过会话内置 imagegen 按原角色参考生成，再做机械配准。`front-repair/registration.json` 记录源图和配准目标；`postures/transitions.json` 记录顺序与脸部定位。地面统一为 y=1400。

当前 CMO3 均已由官方编辑器保存并导出，保留编辑用直通透明度。重新导出后分别运行 `premultiply-export.mjs` 处理两个修复模型的 model3 文件，再运行 `activate-front-repair.mjs` 重新生成主入口及过滤后的服装物理设置。不要用草稿生成器覆盖这些已保存的 CMO3。

验证：`front-rig-authoring.cjs` 检查原生引用、父部件归属和静态滤镜标识；`posture-motion.cjs` 检查动作中断和网格无翻折；`posture-render.cjs` 逐帧检查显示互斥、有效顶点、呼吸、脚底定位及完整起卧循环。已通过 1260 帧起卧检查（重叠帧 0、无效顶点帧 0、准备动作脚底位移 0）、12 种正面动作录制，以及便携包解压后的动作队列与桌面定位检查。当前预览在 `../preview/posture-cycle.webm` 和 `../preview/natural-actions.webm`。v1.1 便携包使用 `powershell -File build-installer.ps1 -PortableOnly` 构建；`-FixPreview` 可另外生成本地预览包。

保留原项目白紫色 Q 版龙娘设定、长卷发、弯角、玫瑰与菱形流苏、紫色眼睛及分层裙装。新增素材由本次会话的内置 imagegen 根据原模型预览生成，继承原角色素材的署名和使用范围，见 assets/NOTICE.md。

## 可编辑文件

- `../model/sideviews/GPTDragon-side-left.cmo3` 与 `GPTDragon-side-right.cmo3`：每侧 7 个网格/原生变形器，支撑腿和摆动腿各 17 个形变键。
- `../model/postures/GPTDragon-postures.cmo3`：五张关键姿势；`ParamPose` 控制姿势间透明度混合，`ParamPostureBreath` 控制局部呼吸变形。
- 两侧及姿势的 `.moc3` 均由官方 Cubism Editor 5.3.04 导出。代码未生成或修改运行用 MOC3 二进制。
- `sideviews/turn-left.png`、`turn-right.png` 是四分之三转向图片，实际运行文件位于 `../model/sideviews`。转向时窗口已停止或接近停止，依次经过侧面、四分之三视角和正面。
- `postures/*.png` 保留生成的透明原图。绑定时只做画布配准，使地面接触点落在源画布 y=1400；`../model/postures/bounds.json` 记录偏移及可见范围。

侧身的脸部暂未独立绑定眨眼和嘴型；卧姿过渡使用关键姿势混合，并非每个关节都可独立操控。这些范围在后续精修时可以继续扩展。

## 提示词整理版

以下为便于复用的语义整理，参考图角色与画风约束用于全部生成：1024×1536 真透明背景，完整角色，无地板、文字、道具、投影与边框；保持原角色头身比例、服装、角、耳朵、尾巴和翅膀细节。

1. 左右严格侧身站立分别绘制，不以水平翻转代替另一侧；视线朝移动方向，头顶约 y=60，脚底约 y=1400。将躯干与长发、左右手臂/腿、翅膀/尾巴分别提供为配准图层，关节重叠部分补全遮挡区。
2. 对身体底图进行补绘：保持头发、脸和裙子原位置，补全手臂与腿移开后露出的躯干，去除重复肢体轮廓。
3. 左右四分之三视角分别绘制，保持站立姿势与相同脚底基线，用于正面与侧面之间的转向。
4. 半蹲：屈膝、重心降低、双手落在膝部，保留原角色头部大小，脚底在 y=1400 附近。
5. 深蹲：膝盖进一步屈曲、髋部降低，脚掌支撑地面，双手自然搭膝，裙摆随屈膝堆叠。
6. 侧坐：髋部落地、双腿折向右侧，近侧手在左侧撑地，眼睛睁开，为躺下做准备。
7. 侧撑：身体向左倾，前臂/肘撑地，双腿折在右侧，眼睛半闭；保持从侧坐到侧卧的连续姿态。
8. 侧躺蜷睡：头在左侧，枕在折叠的前臂上，眼睛闭合；膝盖朝右蜷起，尾巴沿右侧围绕，翅膀收拢。不要枕头、床或其他道具。主体位于画布下方，保留上方透明区域。

## 复现与导出

源码作者工具基于 StretchyStudio MIT writer，固定提交 `24a83a27ba43e43e9d2e3de5e33994594e6199c2`。将该提交源码放入项目 `third_party/stretchystudio`；`prepare-cubism-writer.mjs` 对显式原生变形器的局部坐标做适配，不修改上游源文件。先执行 `npm ci --prefix live2d/tools`。

已有导出工程受到生成脚本保护，避免重新生成草稿覆盖官方 Editor 保存的图集。需要重新绑定时，应在工程副本中生成；通常直接编辑现有 CMO3 即可。

在 Cubism 保存后导出 MOC3、model3、cdi3 和纹理。姿势图集为 4096×4096，两侧各 2048×2048。运行库要求纹理 RGB 预乘透明度：姿势重新导出后运行 `node live2d/tools/premultiply-export.mjs live2d/model/postures/GPTDragon-postures.model3.json`；脚本用哈希记录避免重复预乘。CMO3 内的编辑图像仍保持直通透明度。

不要用旧的修补脚本重复处理已经修补的图集；当前标准命名的侧身 CMO3 已含修补后的身体与手臂资源。

运行验证：`node tests/sideview-motion.cjs`、`node tests/posture-motion.cjs`、`powershell -File tests/run-multiview.ps1` 和 `powershell -File live2d/tools/check-runtime.ps1 -Mode multiview`。预览在 `../preview/side-walk-turn.webm` 和 `../preview/posture-cycle.webm`。
