# v1.05 多视角与姿势素材

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
