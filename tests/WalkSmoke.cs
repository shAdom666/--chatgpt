using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows;
using System.Windows.Threading;
using GPTPet;
// Runs the actual WPF render loop and observes native-window movement, with no
// live API calls. Compiled beside GPTPet.exe so it loads the same art and shader.
class WalkSmoke {
    [STAThread] public static int Main() {
        var app = new Application { ShutdownMode = ShutdownMode.OnMainWindowClose };
        var pet = new PetWindow(); var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(20) };
        var watch = new Stopwatch(); double start = 0, previous = 0, maximumForwardStep = 0; int samples = 0, turns = 0, wrongWay = 0, lastDirection = -1; bool passed = false;
        var flags = BindingFlags.NonPublic | BindingFlags.Instance;
        var walker = (HorizontalWalker)typeof(PetWindow).GetField("walker", flags).GetValue(pet);
        pet.Loaded += delegate {
            var clock = (Stopwatch)typeof(PetWindow).GetField("clock", flags).GetValue(pet);
            typeof(PetWindow).GetField("walkUntil", flags).SetValue(pet, clock.Elapsed.TotalSeconds + 10);
            typeof(PetWindow).GetField("nextWander", flags).SetValue(pet, clock.Elapsed.TotalSeconds + 20);
            typeof(PetWindow).GetField("nextIdleAction", flags).SetValue(pet, clock.Elapsed.TotalSeconds + 20);
            start = previous = pet.Left; lastDirection = walker.Direction; watch.Start(); timer.Start();
        };
        timer.Tick += delegate {
            samples++;
            double position = pet.Left;
            if (position > previous + 0.02) wrongWay++;
            maximumForwardStep = Math.Max(maximumForwardStep, previous - position);
            if (walker.Direction != lastDirection) turns++;
            lastDirection = walker.Direction; previous = position;
            if (watch.Elapsed.TotalSeconds >= 4) {
                timer.Stop(); double distance = start - position;
                passed = samples > 30 && distance > 80 && distance < 150 && turns == 0 && wrongWay == 0 && maximumForwardStep < 12;
                string json = new JavaScriptSerializer().Serialize(new { passed = passed, samples = samples, distanceDip = distance, directionChanges = turns, wrongWaySteps = wrongWay, largestStepDip = maximumForwardStep });
                File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tests", "walk-smoke.json"), json);
                Console.WriteLine(json); pet.Close();
            }
        };
        app.Run(pet); return passed ? 0 : 1;
    }
}
