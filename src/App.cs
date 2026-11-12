using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using System.Windows.Automation;
using Forms = System.Windows.Forms;

namespace GPTPet {
static class Program {
    static Mutex singleInstance;
    [STAThread] public static void Main() {
        string projectRoot = AppDomain.CurrentDomain.BaseDirectory;
        string live2dManifest = Path.Combine(projectRoot, "live2d", "model", "GPTDragon.model3.json");
        if (Array.IndexOf(Environment.GetCommandLineArgs(), "--legacy") < 0) {
            if (!File.Exists(live2dManifest)) { MessageBox.Show("缺少 Live2D 模型，请将 live2d 文件夹与 GPTPet.exe 放在一起。", "ChatGPT 桌宠"); return; }
            string runtimePath = Path.Combine(projectRoot, "live2d", "runtime");
            string electronPath = Path.Combine(runtimePath, "node_modules", "electron", "dist", "electron.exe");
            try {
                var start = new ProcessStartInfo(electronPath, "\"" + runtimePath + "\"" + (Array.IndexOf(Environment.GetCommandLineArgs(), "--chat") >= 0 ? " --chat" : ""));
                start.UseShellExecute = false; start.WorkingDirectory = runtimePath;
                start.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");
                Process.Start(start);
            } catch { MessageBox.Show("Live2D 运行程序无法启动，请检查 live2d/runtime 依赖是否完整。", "ChatGPT 桌宠"); }
            return;
        }
        bool created;
        singleInstance = new Mutex(true, "Local\\GPTDesktopPet-7afc9016", out created);
        if (!created) { MessageBox.Show("桌宠已经在运行，可以在任务栏右下角找到她的图标。", "ChatGPT 桌宠"); return; }
        ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        app.DispatcherUnhandledException += delegate(object sender, DispatcherUnhandledExceptionEventArgs e) {
            MessageBox.Show("遇到一个问题，请重启桌宠。\n" + e.Exception.GetType().Name, "ChatGPT 桌宠"); e.Handled = true;
        };
        try { app.Run(new PetWindow()); }
        catch (Exception e) { MessageBox.Show("启动失败：" + e.Message, "ChatGPT 桌宠"); }
        finally { singleInstance.ReleaseMutex(); singleInstance.Dispose(); }
    }
}
static class UI {
    public static readonly Brush Ink = new SolidColorBrush(Color.FromRgb(54, 43, 76));
    public static readonly Brush Accent = new SolidColorBrush(Color.FromRgb(118, 88, 173));
    public static readonly Brush Muted = new SolidColorBrush(Color.FromRgb(118, 109, 132));
    public static TextBlock Text(string text, double size) {
        return new TextBlock { Text = text, FontSize = size, Foreground = Ink, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 3, 0, 7) };
    }
    public static Button Button(string text, Action action) {
        var b = new Button { Content = text, Padding = new Thickness(12, 8, 12, 8), Margin = new Thickness(0, 0, 8, 0),
            Background = Brushes.White, Foreground = Ink, BorderBrush = new SolidColorBrush(Color.FromRgb(218, 209, 233)), Cursor = Cursors.Hand };
        b.Click += delegate { action(); }; AutomationProperties.SetName(b, text); return b;
    }
    public static Window Window(string title, double width, double height) {
        return new Window { Title = title, Width = width, Height = height, MinWidth = width, MinHeight = height,
            Background = new SolidColorBrush(Color.FromRgb(249, 247, 253)), FontFamily = new FontFamily("Microsoft YaHei UI"),
            FontSize = 14, Foreground = Ink, WindowStartupLocation = WindowStartupLocation.CenterScreen };
    }
}
public sealed class PetWindow : Window {
    readonly DragonSurface pet = new DragonSurface();
    readonly TextBlock bubbleText = UI.Text("点我聊聊 · 右键打开菜单", 12);
    readonly Border bubble;
    readonly Stopwatch clock = Stopwatch.StartNew();
    readonly HorizontalWalker walker = new HorizontalWalker();
    readonly Random random = new Random();
    readonly Forms.NotifyIcon tray;
    readonly Settings settings;
    ChatWindow chat;
    PetMotion motion = PetMotion.Idle;
    TimeSpan lastRenderingTime = TimeSpan.MinValue;
    double stateStarted, actionUntil, nextWander = 20, walkUntil, nextIdleAction = 15, lastTime;
    bool dragging, walking = true, thinking, exiting, smooth = true;
    public bool Thinking { get { return thinking; } set { thinking = value; SetAnimation(value ? PetMotion.Thinking : PetMotion.Idle); } }
    public Settings Config { get { return settings; } }
    public PetWindow() {
        settings = Settings.Load();
        Title = "ChatGPT 娘 · Q 版桌面伙伴";
        WindowStyle = WindowStyle.None; AllowsTransparency = true; Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize; ShowInTaskbar = Array.IndexOf(Environment.GetCommandLineArgs(), "--inspect") >= 0; Topmost = true; ShowActivated = false;
        FontFamily = new FontFamily("Microsoft YaHei UI"); Width = 300; Height = Width + 42;
        RenderOptions.SetBitmapScalingMode(pet, BitmapScalingMode.HighQuality);
        UseLayoutRounding = true;
        var root = new Grid(); root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(42) }); root.RowDefinitions.Add(new RowDefinition());
        bubbleText.Margin = new Thickness(8, 5, 8, 5); bubbleText.TextAlignment = TextAlignment.Center;
        bubble = new Border { Background = new SolidColorBrush(Color.FromArgb(240, 249, 245, 255)), CornerRadius = new CornerRadius(13), Child = bubbleText,
            HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Bottom };
        root.Children.Add(bubble); Grid.SetRow(pet, 1); root.Children.Add(pet); Content = root;
        pet.Cursor = Cursors.Hand;
        AutomationProperties.SetName(pet, "ChatGPT 娘，点击聊天，按住拖动，右键菜单");
        pet.MouseLeftButtonDown += delegate {
            var before = new Point(Left, Top); dragging = true;
            try { DragMove(); } catch (InvalidOperationException) {} finally { dragging = false; }
            Clamp();
            walker.Reset(Left, walker.Direction);
            if (Math.Abs(Left - before.X) + Math.Abs(Top - before.Y) < 5) { ShowChat(); Wave(); }
        };
        var menu = new ContextMenu();
        Add(menu, "和 GPT 聊天", ShowChat); Add(menu, "连接设置…", ShowSettings); Add(menu, "摸摸头 / 招手", Wave);
        Add(menu, "跳一下", delegate { Act(PetMotion.Jump, 10); });
        Add(menu, "吃饼干", delegate { Act(PetMotion.Eat, 48); });
        Add(menu, "开心一下", delegate { Act(PetMotion.Happy, 24); });
        Add(menu, "睡一会", delegate { Act(PetMotion.Sleep, 800); });
        Add(menu, "醒来", delegate { actionUntil = 0; SetAnimation(PetMotion.Idle); });
        var walk = new MenuItem { Header = "自由走动", IsCheckable = true, IsChecked = true };
        walk.Click += delegate { walking = walk.IsChecked; SetAnimation(PetMotion.Idle); }; menu.Items.Add(walk);
        var top = new MenuItem { Header = "总在最前", IsCheckable = true, IsChecked = true };
        top.Click += delegate { Topmost = top.IsChecked; }; menu.Items.Add(top);
        var smoothing = new MenuItem { Header = "自然动态（随屏幕刷新）", IsCheckable = true, IsChecked = true };
        smoothing.Click += delegate { smooth = smoothing.IsChecked; }; menu.Items.Add(smoothing);
        var sizes = new MenuItem { Header = "调整大小" };
        Add(sizes, "小 · 240 像素", delegate { SetSize(240); }); Add(sizes, "中 · 300 像素", delegate { SetSize(300); }); Add(sizes, "大 · 400 像素", delegate { SetSize(400); }); menu.Items.Add(sizes);
        Add(menu, "回到屏幕右下角", Home); Add(menu, "关于与素材署名", About); menu.Items.Add(new Separator()); Add(menu, "退出桌宠", Close); pet.ContextMenu = menu;
        tray = new Forms.NotifyIcon { Text = "ChatGPT 娘 · 点击聊天", Icon = new System.Drawing.Icon(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "pet.ico")), Visible = true };
        var trayMenu = new Forms.ContextMenuStrip();
        trayMenu.Items.Add("和 GPT 聊天", null, delegate { Dispatcher.Invoke(new Action(ShowChat)); });
        trayMenu.Items.Add("回到屏幕右下角", null, delegate { Dispatcher.Invoke(new Action(Home)); });
        trayMenu.Items.Add("连接设置", null, delegate { Dispatcher.Invoke(new Action(ShowSettings)); });
        trayMenu.Items.Add("退出桌宠", null, delegate { Dispatcher.Invoke(new Action(Close)); }); tray.ContextMenuStrip = trayMenu;
        tray.DoubleClick += delegate { Dispatcher.Invoke(new Action(ShowChat)); };
        Loaded += delegate { Home(); if (Array.IndexOf(Environment.GetCommandLineArgs(), "--chat") >= 0) ShowChat(); };
        CompositionTarget.Rendering += Animate;
        Closed += delegate { exiting = true; CompositionTarget.Rendering -= Animate; tray.Visible = false; tray.Dispose(); if (chat != null) chat.Shutdown(); };
    }
    static void Add(ItemsControl menu, string label, Action action) { var item = new MenuItem { Header = label }; item.Click += delegate { action(); }; menu.Items.Add(item); }
    void SetSize(double width) { double floor = Top + Height; Width = width; Height = width + 42; Top = floor - Height; Clamp(); walker.Reset(Left, walker.Direction); }
    void Home() { var area = SystemParameters.WorkArea; Left = area.Right - Width - 32; Top = area.Bottom - Height - 12; Clamp(); walker.Reset(Left, -1); }
    Rect WorkArea() {
        var area = Forms.Screen.FromPoint(new System.Drawing.Point((int)((Left + Width / 2) * Dpi()), (int)((Top + Height / 2) * Dpi()))).WorkingArea;
        double dpi = Dpi(); return new Rect(area.Left / dpi, area.Top / dpi, area.Width / dpi, area.Height / dpi);
    }
    void Clamp() {
        var area = WorkArea();
        Left = Math.Max(area.Left, Math.Min(Left, area.Right - Width)); Top = Math.Max(area.Top, Math.Min(Top, area.Bottom - Height));
    }
    double Dpi() { var source = PresentationSource.FromVisual(this); return source == null ? 1 : source.CompositionTarget.TransformToDevice.M11; }
    void SetAnimation(PetMotion next) { if (motion != next) { motion = next; stateStarted = clock.Elapsed.TotalSeconds; } }
    void Act(PetMotion state, int ticks) { if (thinking) return; SetAnimation(state); stateStarted = clock.Elapsed.TotalSeconds; actionUntil = stateStarted + ticks / 8.0; }
    void Wave() { Act(PetMotion.Wave, 20); }
    void Animate(object sender, EventArgs args) {
        if (!IsLoaded || exiting) return;
        var rendering = args as RenderingEventArgs;
        if (rendering != null) {
            if (rendering.RenderingTime == lastRenderingTime) return;
            lastRenderingTime = rendering.RenderingTime;
        }
        double now = clock.Elapsed.TotalSeconds;
        double delta = Math.Max(0, Math.Min(0.1, now - lastTime)); lastTime = now;
        if (now > 8) bubble.Visibility = Visibility.Collapsed;
        if (!dragging) {
            if (thinking) SetAnimation(PetMotion.Thinking);
            else if (now >= actionUntil) {
                bool canWalk = walking && (chat == null || !chat.IsVisible);
                if (now >= nextWander) { nextWander = now + 20; if (canWalk) walkUntil = now + 4; }
                if (canWalk && now < walkUntil) SetAnimation(walker.Direction > 0 ? PetMotion.WalkRight : PetMotion.WalkLeft);
                else {
                    SetAnimation(PetMotion.Idle);
                    if (now >= nextIdleAction) { nextIdleAction = now + 12 + random.NextDouble() * 12; Act(random.Next(2) == 0 ? PetMotion.Happy : PetMotion.Eat, 32); }
                }
            }
            bool moving = motion == PetMotion.WalkRight || motion == PetMotion.WalkLeft;
            var area = WorkArea();
            walker.Step(moving && !thinking, delta, area.Left, area.Right - Width);
            // Display may round, but that rounded coordinate is never fed back
            // into the motion integrator or used as a collision detector.
            Left = walker.Position;
            if (moving) SetAnimation(walker.Direction > 0 ? PetMotion.WalkRight : PetMotion.WalkLeft);
        }
        var cursor = Forms.Cursor.Position;
        var local = PointFromScreen(new Point(cursor.X, cursor.Y));
        double lookX = Math.Max(-1, Math.Min(1, (local.X - Width / 2) / 450));
        double lookY = Math.Max(-1, Math.Min(1, (local.Y - Height / 2) / 450));
        pet.Step(now, delta, dragging ? PetMotion.Dragged : motion, lookX, lookY, smooth);
    }
    public void ShowChat() {
        if (exiting) return;
        if (chat == null) chat = new ChatWindow(this);
        actionUntil = 0; SetAnimation(PetMotion.Idle); chat.Show(); chat.Activate();
    }
    public void ShowSettings() {
        ShowChat(); chat.Configure();
    }
    void About() { MessageBox.Show("ChatGPT 娘 · 桌面伙伴\n\n当前六姿态图：用户提供；内置 imagegen 制作透明贴图。\n原角色设定：ZipZipPipe。仅限非商业使用。\n旧动画素材：savanna0425/llm-pet，署名见 assets/NOTICE.md。\n\n当前为实时贴图形变，非完整 Live2D 模型。\n渲染：" + (pet.HardwareMotion ? "实时形变着色器" : "兼容模式") + "\n参考：VPet、AIRI、Open-LLM-VTuber（见 动画实现说明.txt）。\n\n本程序为独立同人桌宠，与 OpenAI 无官方关联。", "关于桌宠"); }
}
public sealed class ChatWindow : Window {
    readonly PetWindow owner;
    readonly GptClient api = new GptClient();
    readonly List<Turn> history = new List<Turn>();
    readonly StackPanel messages = new StackPanel();
    readonly TextBlock state = UI.Text("", 12);
    readonly ScrollViewer scroll;
    readonly TextBox input;
    readonly Button send, clear, config;
    CancellationTokenSource pending;
    bool shuttingDown;
    public ChatWindow(PetWindow owner) {
        this.owner = owner; Title = "和 ChatGPT 娘聊聊"; Width = 440; Height = 620; MinWidth = 360; MinHeight = 470;
        Background = new SolidColorBrush(Color.FromRgb(249, 247, 253)); FontFamily = new FontFamily("Microsoft YaHei UI"); FontSize = 14;
        var root = new Grid { Margin = new Thickness(20) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); root.RowDefinitions.Add(new RowDefinition()); root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        var header = new StackPanel(); header.Children.Add(UI.Text("ChatGPT 娘", 24)); header.Children.Add(UI.Text("桌面上的小小陪伴", 12));
        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 7, 0, 7) };
        config = UI.Button("连接设置", Configure); clear = UI.Button("新对话", Clear);
        actions.Children.Add(config); actions.Children.Add(clear); header.Children.Add(actions); state.Foreground = UI.Muted; header.Children.Add(state); root.Children.Add(header);
        scroll = new ScrollViewer { Content = messages, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Margin = new Thickness(0, 8, 0, 12) }; Grid.SetRow(scroll, 1); root.Children.Add(scroll);
        var compose = new StackPanel(); input = new TextBox { AcceptsReturn = true, TextWrapping = TextWrapping.Wrap, MinHeight = 72, MaxHeight = 160, VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            Padding = new Thickness(10), FontSize = 14, BorderBrush = new SolidColorBrush(Color.FromRgb(218, 209, 233)), Background = Brushes.White };
        AutomationProperties.SetName(input, "输入消息");
        input.PreviewKeyDown += delegate(object sender, KeyEventArgs e) { if (e.Key == Key.Enter && (Keyboard.Modifiers & ModifierKeys.Shift) == 0) { e.Handled = true; Send(); } };
        compose.Children.Add(input);
        var bottom = new DockPanel { Margin = new Thickness(0, 10, 0, 0) }; send = UI.Button("发送", Send); send.Background = UI.Accent; send.Foreground = Brushes.White; send.Margin = new Thickness(8, 0, 0, 0);
        DockPanel.SetDock(send, Dock.Right); bottom.Children.Add(send); var hint = UI.Text("Enter 发送 · Shift+Enter 换行", 11); hint.Foreground = UI.Muted; hint.VerticalAlignment = VerticalAlignment.Center; bottom.Children.Add(hint); compose.Children.Add(bottom); Grid.SetRow(compose, 2); root.Children.Add(compose); Content = root;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Closing += delegate(object sender, System.ComponentModel.CancelEventArgs e) { if (!shuttingDown) { e.Cancel = true; Hide(); } };
        Loaded += delegate { input.Focus(); }; Welcome(); RefreshStatus();
    }
    void Welcome() { Add("ChatGPT 娘", "我在这里陪你。可以和我聊想法、问问题，或一起想想今天要做什么。\n\n第一次使用，请点「连接设置」填写 OpenAI API Key。对话仅保留在本次运行中，点击「新对话」可清空。"); }
    void RefreshStatus() { state.Text = String.IsNullOrWhiteSpace(owner.Config.Key) ? "尚未连接 · 请先设置 API Key" : "已配置 · " + owner.Config.Model + " · 发送消息后连接"; }
    void Add(string name, string text) {
        var panel = new StackPanel(); var label = UI.Text(name, 11); label.Foreground = UI.Muted; panel.Children.Add(label);
        var content = new TextBox { Text = text, IsReadOnly = true, TextWrapping = TextWrapping.Wrap, BorderThickness = new Thickness(0), Background = Brushes.Transparent,
            Foreground = UI.Ink, FontSize = 14, Padding = new Thickness(0), IsReadOnlyCaretVisible = false };
        AutomationProperties.SetName(content, name + "的消息"); panel.Children.Add(content);
        messages.Children.Add(new Border { Child = panel, Padding = new Thickness(13), Margin = new Thickness(name == "你" ? 28 : 0, 0, name == "你" ? 0 : 18, 10),
            CornerRadius = new CornerRadius(13), Background = new SolidColorBrush(name == "你" ? Color.FromRgb(235, 226, 248) : Color.FromRgb(255, 255, 255)) });
        scroll.ScrollToEnd();
    }
    void Clear() { if (pending != null) return; history.Clear(); messages.Children.Clear(); Welcome(); RefreshStatus(); }
    public async void Send() {
        if (pending != null) { pending.Cancel(); return; }
        string text = input.Text.Trim(); if (text.Length == 0) return;
        if (text.Length > 8000) { MessageBox.Show(this, "这条消息较长，请缩短到 8000 字以内。", "消息太长"); return; }
        if (String.IsNullOrWhiteSpace(owner.Config.Key)) { Configure(); return; }
        Add("你", text); input.Clear(); var cts = new CancellationTokenSource(); pending = cts; owner.Thinking = true;
        send.Content = "停止"; clear.IsEnabled = false; config.IsEnabled = false; state.Text = "正在思考…";
        try {
            string reply = await api.ReplyAsync(owner.Config.Key, owner.Config.Model, history, text, cts.Token);
            if (shuttingDown) return;
            history.Add(new Turn("user", text)); history.Add(new Turn("assistant", reply));
            if (history.Count > 20) history.RemoveRange(0, history.Count - 20);
            Add("ChatGPT 娘", reply); state.Text = "已连接 · " + owner.Config.Model;
        } catch (OperationCanceledException) {
            if (!shuttingDown) { Add("连接提示", cts.IsCancellationRequested ? "已停止。本次消息未加入后续对话。" : "连接超时，请检查网络后重试。"); state.Text = "本次请求已停止"; input.Text = text; }
        } catch (Exception e) {
            if (!shuttingDown) {
                string error = e is InvalidOperationException ? e.Message : "连接未成功，请检查网络、API Key 和模型设置后重试。";
                Add("连接提示", error); state.Text = "连接未成功"; input.Text = text;
            }
        } finally {
            pending = null; cts.Dispose(); owner.Thinking = false; send.Content = "发送"; clear.IsEnabled = true; config.IsEnabled = true;
        }
    }
    public void Configure() {
        if (pending != null) return;
        var dialog = UI.Window("连接 GPT", 430, 530); dialog.Owner = this; dialog.ResizeMode = ResizeMode.NoResize; dialog.WindowStartupLocation = WindowStartupLocation.CenterOwner;
        var panel = new StackPanel { Margin = new Thickness(24) }; panel.Children.Add(UI.Text("连接你的 GPT", 23));
        panel.Children.Add(UI.Text("使用 OpenAI API 聊天。每次发送会把本次对话最近 10 轮发给 OpenAI，API 用量由你的 API 账户计费。", 13));
        panel.Children.Add(UI.Text("OpenAI API Key", 13));
        var key = new PasswordBox { Password = owner.Config.Key, Padding = new Thickness(9), FontSize = 14 }; AutomationProperties.SetName(key, "OpenAI API Key"); panel.Children.Add(key);
        panel.Children.Add(UI.Text("密钥用 Windows 用户凭据加密，保存在本机。", 11)); panel.Children.Add(UI.Text("模型名称", 13));
        var model = new TextBox { Text = owner.Config.Model, Padding = new Thickness(9), FontSize = 14 }; AutomationProperties.SetName(model, "模型名称"); panel.Children.Add(model);
        panel.Children.Add(UI.Text("可填写你的 API 账户有权使用的模型。保存只保存设置，首次发送消息时才验证连接。", 12));
        var error = UI.Text(owner.Config.Warning, 12); error.Foreground = Brushes.Firebrick; panel.Children.Add(error);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 10, 0, 0) };
        actions.Children.Add(UI.Button("保存设置", delegate {
            try { owner.Config.Save(key.Password, model.Text); owner.Config.Warning = ""; RefreshStatus(); dialog.Close(); }
            catch (Exception ex) { error.Text = ex is ArgumentException ? ex.Message : "保存失败，请检查本机用户目录的写入权限。"; }
        }));
        actions.Children.Add(UI.Button("清除密钥", delegate { key.Clear(); })); panel.Children.Add(actions);
        panel.Children.Add(UI.Button("打开 OpenAI API 密钥页面", delegate { Process.Start("https://platform.openai.com/api-keys"); })); dialog.Content = panel; dialog.ShowDialog();
    }
    public void Shutdown() { shuttingDown = true; if (pending != null) pending.Cancel(); Close(); api.Dispose(); }
}
}
