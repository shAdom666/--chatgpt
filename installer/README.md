# Windows 安装包构建

在项目根目录运行 `powershell -NoProfile -File build-installer.ps1`。
需要本地 Inno Setup 7 编译器；默认读取 `tools/InnoSetup/ISCC.exe`，可用 `-CompilerPath` 指定其他路径。
本机编译器来自 Inno Setup 官方 7.1.1 x64 安装程序，验证发布者 Pyrsys B.V. 的有效签名后，以 `/PORTABLE=1` 解包在项目 tools 中。

构建脚本从明确文件清单创建新的 `_build` 暂存目录，仅复制当前运行模型、运行程序、离线依赖和许可证。
`dist/GPTDragonPet-Setup-1.05-x64.exe` 为单文件安装包，旁边提供 SHA-256 和构建报告。
没有附加代码签名证书。

安装使用当前用户权限，默认位置 `%LOCALAPPDATA%\Programs\GPTDragonPet`，含桌面与开始菜单快捷方式、Windows 卸载登记及卸载程序。
不设置开机自启，卸载只移除安装程序记录的文件，保留用户连接设置。
依赖 Windows 10 2004+/Windows 11 x64 兼容环境及 .NET Framework 4.8+。

验证命令：`powershell -NoProfile -File tests/installer-check.ps1`。
该脚本会临时安装到项目 `_build` 中、检查每个文件的 SHA-256、再次安装验证升级、用安装目录中的 Electron 实际渲染 36 参数模型、调用本地 GPT 配置读取组件，然后卸载验证。
测试不发送 API 请求，不读取或输出密钥内容，验证已有设置文件的哈希不变。
如果此 AppId 已有正式安装，测试会停止，避免改写其卸载信息。

官方构建器：[Inno Setup](https://jrsoftware.org/isdl.php)。
组件许可和个人项目说明随安装包一起交付。
