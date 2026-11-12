using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using GPTPet;
class FakeHandler : HttpMessageHandler {
    public HttpStatusCode Status = HttpStatusCode.OK;
    public string Body = "{\"status\":\"completed\",\"output\":[{\"type\":\"reasoning\"},{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"你好\"}]}]}";
    public string RequestBody; public string Host; public string Authorization;
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
        token.ThrowIfCancellationRequested(); RequestBody = await request.Content.ReadAsStringAsync(); Host = request.RequestUri.Host; Authorization = request.Headers.Authorization.ToString();
        return new HttpResponseMessage(Status) { Content = new StringContent(Body) };
    }
}
class Tests {
    static int count;
    static void Assert(bool ok, string label) { if (!ok) throw new Exception(label); Console.WriteLine("PASS " + label); count++; }
    static async Task Run() {
        string secret = "test-only-key"; Assert(Settings.Unprotect(Settings.Protect(secret)) == secret, "DPAPI roundtrip"); Assert(!Settings.Protect(secret).Contains(secret), "no plaintext key");
        var fake = new FakeHandler(); using (var api = new GptClient(fake)) {
            var history = new List<Turn>(); for (int i = 0; i < 30; i++) history.Add(new Turn(i % 2 == 0 ? "user" : "assistant", "message" + i));
            string reply = await api.ReplyAsync(secret, "test-model", history, "hello", CancellationToken.None);
            Assert(reply == "你好", "extract message after reasoning output"); Assert(fake.Host == "api.openai.com", "official endpoint only"); Assert(fake.Authorization == "Bearer test-only-key", "bearer authentication");
            var payload = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(fake.RequestBody);
            Assert((bool)payload["store"] == false, "disable server-side response storage"); Assert(((System.Collections.IList)payload["input"]).Count == 21, "bound history to ten turns plus input");
            Assert(!fake.RequestBody.Contains(secret), "key excluded from payload");
            fake.Status = HttpStatusCode.Unauthorized;
            try { await api.ReplyAsync(secret, "test-model", history, "hello", CancellationToken.None); throw new Exception("expected 401 error"); }
            catch (InvalidOperationException e) { Assert(e.Message.Contains("API Key"), "friendly authentication error"); }
            fake.Status = (HttpStatusCode)429;
            try { await api.ReplyAsync(secret, "test-model", history, "hello", CancellationToken.None); throw new Exception("expected 429 error"); }
            catch (InvalidOperationException e) { Assert(e.Message.Contains("余额"), "friendly quota error"); }
            try { api.Parse("{\"status\":\"incomplete\",\"output\":[]}"); throw new Exception("expected incomplete error"); }
            catch (InvalidOperationException e) { Assert(e.Message.Contains("未完整"), "incomplete reply does not become history"); }
            Assert(api.Parse("{\"status\":\"completed\",\"output\":[{\"content\":[{\"type\":\"refusal\",\"refusal\":\"不能协助\"}]}]}") == "不能协助", "refusal displayed");
            var canceled = new CancellationTokenSource(); canceled.Cancel();
            try { await api.ReplyAsync(secret, "test-model", history, "hello", canceled.Token); throw new Exception("expected cancellation"); }
            catch (OperationCanceledException) { Assert(true, "request cancellation"); }
        }
        Console.WriteLine("Passed " + count + " checks. No live API calls.");
    }
    public static int Main() { try { Run().GetAwaiter().GetResult(); return 0; } catch (Exception e) { Console.WriteLine(e); return 1; } }
}
