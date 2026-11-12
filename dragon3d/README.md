# 龙娘 3D 工程

`Dragon.blend` 可以直接在 Blender 中打开。贴图已打包。骨架使用两个动作，`Stride` 控制步态，`StandToCurledSleep` 从站姿经过蹲姿进入侧躺。桌宠根据行走距离采样步态，根据当前姿势向前或向后采样起卧动作。

默认桌宠从 `live2d/model/dragon3d/Dragon.glb` 加载角色。要修改参数化原型，在仓库根目录执行以下命令。

```powershell
python -m pip install numpy Pillow
python dragon3d/character.py
blender --background --python dragon3d/save_blend.py
```

安装模型生成所需的 Python 依赖后，运行 character.py 重建 GLB，再运行 Blender 命令从 GLB 生成 Dragon.blend。手工精修时请另存 Blender 工程，避免重新生成时覆盖。当前运行端按骨骼名和动作名寻找角色各部位。

渲染源码在 `live2d/runtime/dragon3d`。在该目录运行 `npm ci` 和 `npm run build` 可更新随项目分发的离线渲染脚本。构建便携包和验证解压后的程序可在仓库根目录执行。

```powershell
.\build-installer.ps1 -PortableOnly
.\tests\portable-check.ps1
```

动画混合参考 [Three.js 骨骼动画示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_animation_skinning_blending.html)。角色网格在本工程生成，脸型、刘海和服装依据 v1.1 正面与侧面画稿塑形。头发与礼服使用环绕 UV，龙角、脸侧发束、发饰与尾巴采用独立的立体几何。
