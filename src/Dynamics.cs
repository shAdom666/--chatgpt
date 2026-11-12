using System;
namespace GPTPet {
public enum PetMotion { Idle, WalkRight, WalkLeft, Wave, Happy, Jump, Sleep, Eat, Thinking, Dragged }
// Exact critically damped spring step; no frame-rate-dependent lerp coefficient.
public sealed class MotionSpring {
    public double Value, Velocity;
    public void Step(double target, double dt, double frequency) {
        dt = Math.Max(0, Math.Min(dt, 0.1));
        double offset = Value - target;
        double decay = Math.Exp(-frequency * dt);
        double term = (Velocity + frequency * offset) * dt;
        Value = target + (offset + term) * decay;
        Velocity = (Velocity - frequency * term) * decay;
    }
}
// Keep the continuous position separate from Window.Left: the native window can
// round to whole device pixels, especially during the first slow acceleration.
public sealed class HorizontalWalker {
    readonly MotionSpring speed = new MotionSpring();
    public double Position { get; private set; }
    public int Direction { get; private set; }
    public HorizontalWalker() { Direction = 1; }
    public void Reset(double position, int direction) {
        Position = position; Direction = direction < 0 ? -1 : 1;
        speed.Value = 0; speed.Velocity = 0;
    }
    public void Step(bool walking, double dt, double minimum, double maximum) {
        dt = Math.Max(0, Math.Min(0.1, dt));
        if (maximum <= minimum) { Position = minimum; speed.Value = 0; speed.Velocity = 0; return; }
        Position = Math.Max(minimum, Math.Min(maximum, Position));
        speed.Step(walking ? Direction * 32 : 0, dt, 8);
        double proposed = Position + speed.Value * dt;
        bool hitLeft = proposed < minimum && speed.Value < 0;
        bool hitRight = proposed > maximum && speed.Value > 0;
        Position = Math.Max(minimum, Math.Min(maximum, proposed));
        if (hitLeft || hitRight) {
            if (walking && ((hitLeft && Direction < 0) || (hitRight && Direction > 0))) Direction = hitLeft ? 1 : -1;
            speed.Value = 0; speed.Velocity = 0;
        }
    }
}
public static class MotionMath {
    public static int Pose(PetMotion state) {
        if (state == PetMotion.Happy) return 1;
        if (state == PetMotion.Sleep) return 2;
        if (state == PetMotion.WalkLeft || state == PetMotion.WalkRight) return 3;
        if (state == PetMotion.Eat) return 4;
        if (state == PetMotion.Wave) return 5;
        return 0;
    }
    public static double Ease(double value) { double x = Math.Max(0, Math.Min(1, value)); return x * x * (3 - 2 * x); }
    public static double Jump(double seconds) {
        // Anticipation, takeoff, flight, landing and recovery, with no loop reset.
        if (seconds < 0.16 || seconds > 1.0) return 0;
        double phase = Math.Min(1, (seconds - 0.16) / 0.7);
        return Math.Sin(Math.PI * phase) * 27;
    }
}
}
