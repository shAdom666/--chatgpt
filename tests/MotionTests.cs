using System;
using GPTPet;
class MotionTests {
    static int checks;
    static void Assert(bool ok, string name) { if (!ok) throw new Exception(name); checks++; Console.WriteLine("PASS " + name); }
    static double Simulate(int fps) { var spring = new MotionSpring(); for (int i = 0; i < fps; i++) spring.Step(1, 1.0 / fps, 8); return spring.Value; }
    static void WalkRegression(int fps, int direction) {
        var walker = new HorizontalWalker(); walker.Reset(500, direction);
        double previous = walker.Position;
        bool monotonic = true;
        for (int i = 0; i < fps * 3; i++) {
            walker.Step(true, 1.0 / fps, 0, 1000);
            monotonic &= (walker.Position - previous) * direction >= 0 && walker.Direction == direction;
            previous = walker.Position;
        }
        Assert(monotonic && (walker.Position - 500) * direction > 80, "startup moves continuously without false wall hits at " + fps + " Hz, direction " + direction);
        for (int i = 0; i < fps; i++) walker.Step(false, 1.0 / fps, 0, 1000);
        Assert((walker.Position - previous) * direction >= 0 && Math.Abs(walker.Position - previous) < 12 && walker.Direction == direction, "smooth stop does not turn around at " + fps + " Hz");
    }
    public static int Main() {
        try {
            Assert(Math.Abs(Simulate(30) - Simulate(60)) < 1e-10 && Math.Abs(Simulate(60) - Simulate(144)) < 1e-10, "spring motion independent of display refresh rate");
            var spring = new MotionSpring(); double previous = 0;
            for (int i = 0; i < 120; i++) { spring.Step(1, 1.0 / 60, 8); Assert(spring.Value >= previous && spring.Value <= 1, "no overshoot step " + i); previous = spring.Value; }
            spring.Step(-1, 1.0 / 60, 8); Assert(!double.IsNaN(spring.Value) && Math.Abs(spring.Value) < 1.1, "direction change stays finite");
            Assert(MotionMath.Pose(PetMotion.WalkLeft) == MotionMath.Pose(PetMotion.WalkRight), "same sharp walking art mirrored for left direction");
            Assert(MotionMath.Pose(PetMotion.Sleep) == 2 && MotionMath.Pose(PetMotion.Eat) == 4 && MotionMath.Pose(PetMotion.Wave) == 5, "reference sheet pose mapping");
            Assert(MotionMath.Jump(0) == 0 && MotionMath.Jump(1.1) == 0 && MotionMath.Jump(0.51) > 26, "jump anticipation, flight and settled landing");
            Assert(MotionMath.Ease(-1) == 0 && MotionMath.Ease(2) == 1, "transition easing endpoints bounded");
            foreach (int fps in new[] { 30, 60, 120, 144, 240 }) { WalkRegression(fps, 1); WalkRegression(fps, -1); }
            foreach (int initial in new[] { -1, 1 }) {
                var walker = new HorizontalWalker(); walker.Reset(initial < 0 ? 0 : 100, initial);
                int turns = 0, last = initial;
                for (int i = 0; i < 240; i++) { walker.Step(true, 1.0 / 240, 0, 100); if (walker.Direction != last) turns++; last = walker.Direction; }
                Assert(turns == 1 && walker.Position > 10 && walker.Position < 90, "true wall reverses exactly once, initial direction " + initial);
            }
            var narrow = new HorizontalWalker(); narrow.Reset(20, 1);
            for (int i = 0; i < 300; i++) narrow.Step(true, 1.0 / 60, 10, 5);
            Assert(narrow.Position == 10 && narrow.Direction == 1, "window wider than work area stays still without flipping");
            var negative = new HorizontalWalker(); negative.Reset(-1400, 1);
            for (int i = 0; i < 300; i++) negative.Step(true, 1.0 / 60, -1600, -300);
            Assert(negative.Position > -1260 && negative.Position < -1240 && negative.Direction == 1, "negative monitor coordinates supported");
            var subpixel = new HorizontalWalker(); subpixel.Reset(500, 1); subpixel.Step(true, 1.0 / 144, 0, 1000);
            Assert(subpixel.Position > 500 && subpixel.Position < 500.01 && subpixel.Direction == 1, "sub-0.01-pixel first step is movement, not collision");
            Console.WriteLine("Passed " + checks + " motion checks."); return 0;
        } catch (Exception e) { Console.WriteLine(e); return 1; }
    }
}
