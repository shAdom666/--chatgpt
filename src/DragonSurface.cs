using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Media.Media3D;

namespace GPTPet {
public sealed class DragonEffect : ShaderEffect {
    public static readonly DependencyProperty InputProperty = RegisterPixelShaderSamplerProperty("Input", typeof(DragonEffect), 0, SamplingMode.Bilinear);
    public static readonly DependencyProperty ClosedEyesProperty = RegisterPixelShaderSamplerProperty("ClosedEyes", typeof(DragonEffect), 1, SamplingMode.Bilinear);
    public static readonly DependencyProperty AnimProperty = DependencyProperty.Register("Anim", typeof(Point4D), typeof(DragonEffect), new UIPropertyMetadata(new Point4D(), PixelShaderConstantCallback(0)));
    public static readonly DependencyProperty MoodProperty = DependencyProperty.Register("Mood", typeof(Point4D), typeof(DragonEffect), new UIPropertyMetadata(new Point4D(), PixelShaderConstantCallback(1)));
    public Brush Input { get { return (Brush)GetValue(InputProperty); } set { SetValue(InputProperty, value); } }
    public Brush ClosedEyes { get { return (Brush)GetValue(ClosedEyesProperty); } set { SetValue(ClosedEyesProperty, value); } }
    public Point4D Anim { get { return (Point4D)GetValue(AnimProperty); } set { SetValue(AnimProperty, value); } }
    public Point4D Mood { get { return (Point4D)GetValue(MoodProperty); } set { SetValue(MoodProperty, value); } }
    public DragonEffect() {
        PixelShader = new PixelShader { UriSource = new Uri(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "dragon-v3", "dragon.ps")) };
        UpdateShaderValue(InputProperty); UpdateShaderValue(ClosedEyesProperty); UpdateShaderValue(AnimProperty); UpdateShaderValue(MoodProperty);
    }
}
public sealed class DragonSurface : Image {
    readonly BitmapSource[] poses = new BitmapSource[6];
    readonly ImageBrush[] eyelids = new ImageBrush[6];
    readonly MotionSpring gazeX = new MotionSpring(), gazeY = new MotionSpring(), lean = new MotionSpring(), stride = new MotionSpring();
    readonly ScaleTransform scale = new ScaleTransform();
    readonly RotateTransform rotate = new RotateTransform();
    readonly TranslateTransform translate = new TranslateTransform();
    readonly Random random = new Random();
    readonly DragonEffect shader;
    PetMotion state = PetMotion.Idle;
    double stateStarted, poseChanged = -10, nextBlink = 3.2, blinkStarted = -10;
    int currentPose;
    public bool HardwareMotion { get { return shader != null; } }
    public DragonSurface() {
        Stretch = Stretch.Uniform; RenderTransformOrigin = new Point(0.5, 0.92);
        RenderOptions.SetBitmapScalingMode(this, BitmapScalingMode.HighQuality);
        var transforms = new TransformGroup(); transforms.Children.Add(scale); transforms.Children.Add(rotate); transforms.Children.Add(translate); RenderTransform = transforms;
        for (int i = 0; i < 6; i++) {
            poses[i] = Load("pose" + i + ".png");
            eyelids[i] = new ImageBrush(Load("blink" + i + ".png")) { Stretch = Stretch.Fill }; eyelids[i].Freeze();
        }
        Source = poses[0];
        if (RenderCapability.IsPixelShaderVersionSupported(3, 0)) { shader = new DragonEffect(); shader.ClosedEyes = eyelids[0]; Effect = shader; }
    }
    static BitmapSource Load(string name) {
        var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad;
        image.UriSource = new Uri(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", "dragon-v3", name)); image.EndInit();
        if (image.PixelWidth != 512 || image.PixelHeight != 512) throw new InvalidDataException("角色姿态素材尺寸应为 512×512。");
        image.Freeze(); return image;
    }
    public void Step(double now, double dt, PetMotion desired, double lookX, double lookY, bool enabled) {
        if (desired != state) { state = desired; stateStarted = now; if (MotionMath.Pose(desired) != currentPose) poseChanged = now; }
        double transition = now - poseChanged;
        int targetPose = MotionMath.Pose(state);
        // Enter/exit squash hides the pose cut at its slowest, lowest point.
        // The texture is always one sharp pose; it is never blended with another.
        if (transition >= 0.12 && targetPose != currentPose) { currentPose = targetPose; Source = poses[currentPose]; if (shader != null) shader.ClosedEyes = eyelids[currentPose]; }
        double poseDip = transition < 0.3 ? Math.Sin(Math.PI * transition / 0.3) : 0;
        bool walking = state == PetMotion.WalkLeft || state == PetMotion.WalkRight;
        bool sleeping = state == PetMotion.Sleep;
        gazeX.Step(sleeping ? 0 : lookX, dt, 7); gazeY.Step(sleeping ? 0 : lookY, dt, 7);
        stride.Step(walking ? 1 : 0, dt, 9);
        double targetLean = walking ? (state == PetMotion.WalkLeft ? -1.3 : 1.3) : state == PetMotion.Thinking ? -1.4 : state == PetMotion.Dragged ? 4 : 0;
        lean.Step(targetLean, dt, 9);
        double age = now - stateStarted;
        double breath = Math.Sin(now * (sleeping ? 1.3 : 1.9));
        double hop = state == PetMotion.Jump ? MotionMath.Jump(age) : 0;
        double squash = state == PetMotion.Jump && age < 0.16 ? Math.Sin(age / 0.16 * Math.PI) * 0.035 : 0;
        double landing = state == PetMotion.Jump && age > 0.86 && age < 1.12 ? Math.Sin((age - 0.86) / 0.26 * Math.PI) * 0.025 : 0;
        double sway = (Math.Sin(now * 1.05) * 0.55 + Math.Sin(now * 0.43) * 0.22) * (sleeping ? 0.2 : 1);
        double wave = state == PetMotion.Wave ? Math.Sin(age * 8) * 0.8 : 0;
        scale.ScaleX = (state == PetMotion.WalkLeft ? -1 : 1) * (1 + squash + landing + poseDip * 0.012);
        scale.ScaleY = 1 + breath * (sleeping ? 0.006 : 0.0025) - squash - landing - poseDip * 0.022;
        rotate.Angle = enabled ? sway + lean.Value + wave : 0;
        translate.Y = enabled ? -hop - Math.Abs(Math.Sin(now * 4.75)) * stride.Value * 2.6 + poseDip * 2 : 0;
        translate.X = enabled ? Math.Sin(now * 1.05) * 0.6 : 0;
        if (!enabled) { scale.ScaleX = state == PetMotion.WalkLeft ? -1 : 1; scale.ScaleY = 1; }
        double blink = 0;
        if (currentPose == 0 && !sleeping && enabled) {
            if (now >= nextBlink) { blinkStarted = now; nextBlink = now + 3 + random.NextDouble() * 3.5; }
            double b = now - blinkStarted;
            if (b < 0.07) blink = MotionMath.Ease(b / 0.07);
            else if (b < 0.12) blink = 1;
            else if (b < 0.23) blink = 1 - MotionMath.Ease((b - 0.12) / 0.11);
        }
        if (shader != null) {
            shader.Anim = new Point4D(now % 10000, enabled ? (sleeping ? 0.3 : 1) : 0, gazeX.Value, gazeY.Value);
            shader.Mood = new Point4D(blink, enabled ? stride.Value : 0, enabled && state == PetMotion.Wave ? 1 : 0, sleeping ? 1 : 0);
        }
    }
}
}
