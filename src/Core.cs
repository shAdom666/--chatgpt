using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace GPTPet {
public sealed class Settings {
    public string Model = "gpt-5.4-mini";
    public string Key = "";
    public string Warning = "";
    public static readonly string Folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GPTDesktopPet");
    public static readonly string FilePath = Path.Combine(Folder, "settings.json");
    public static Settings Load() {
        Settings s = new Settings();
        try {
            if (File.Exists(FilePath)) {
                var data = new JavaScriptSerializer().Deserialize<Dictionary<string, string>>(File.ReadAllText(FilePath));
                if (data.ContainsKey("model")) s.Model = data["model"];
                if (data.ContainsKey("protectedKey") && data["protectedKey"].Length > 0)
                    s.Key = Unprotect(data["protectedKey"]);
            }
        } catch { s.Warning = "无法读取上次的设置，请重新填写 API Key。"; }
        if (String.IsNullOrWhiteSpace(s.Key)) s.Key = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "";
        return s;
    }
    public static string Protect(string value) {
        return Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(value), null, DataProtectionScope.CurrentUser));
    }
    public static string Unprotect(string value) {
        return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(value), null, DataProtectionScope.CurrentUser));
    }
    public void Save(string key, string model) {
        key = key.Trim(); model = model.Trim();
        if (model.Length == 0) throw new ArgumentException("请填写模型名称。");
        foreach (char c in key) if (c < 33 || c > 126) throw new ArgumentException("API Key 含有空格或无效字符，请检查粘贴的内容。");
        Directory.CreateDirectory(Folder);
        string temp = FilePath + ".tmp";
        File.WriteAllText(temp, new JavaScriptSerializer().Serialize(new Dictionary<string, string> {
            {"model", model}, {"protectedKey", key.Length == 0 ? "" : Protect(key)}
        }), Encoding.UTF8);
        if (File.Exists(FilePath)) File.Replace(temp, FilePath, null); else File.Move(temp, FilePath);
        Key = key; Model = model;
    }
}
public sealed class Turn {
    public string role;
    public string content;
    public Turn(string role, string content) { this.role = role; this.content = content; }
}
public sealed class GptClient : IDisposable {
    readonly HttpClient client;
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 4000000 };
    public GptClient() : this(new HttpClientHandler { AllowAutoRedirect = false }) {}
    public GptClient(HttpMessageHandler handler) { client = new HttpClient(handler); client.Timeout = TimeSpan.FromSeconds(120); }
    public string Payload(string model, IList<Turn> history, string text) {
        var input = new List<object>();
        for (int i = Math.Max(0, history.Count - 20); i < history.Count; i++)
            input.Add(new { role = history[i].role, content = history[i].content });
        input.Add(new { role = "user", content = text });
        return json.Serialize(new { model = model, input = input,
            instructions = "你是用户的 ChatGPT 桌面伙伴，形象是银白发的龙娘。自然、温柔、简洁地用中文交流，也可以按用户要求使用其他语言。诚实说明能力边界。你只有聊天能力，不能声称已经读取屏幕、操控电脑或执行本机操作。",
            store = false, max_output_tokens = 4096 });
    }
    public async Task<string> ReplyAsync(string key, string model, IList<Turn> history, string text, CancellationToken token) {
        if (String.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("先点「连接设置」，填写 OpenAI API Key。");
        using (var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/responses")) {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            request.Content = new StringContent(Payload(model, history, text), Encoding.UTF8, "application/json");
            using (var response = await client.SendAsync(request, token)) {
                string body = await response.Content.ReadAsStringAsync();
                token.ThrowIfCancellationRequested();
                if (!response.IsSuccessStatusCode) {
                    int status = (int)response.StatusCode;
                    if (status == 401) throw new InvalidOperationException("API Key 无效或已失效，请在连接设置中检查。");
                    if (status == 403) throw new InvalidOperationException("访问被拒绝，请检查账户权限和服务可用地区。");
                    if (status == 429) throw new InvalidOperationException("请求受限或 API 余额不足，请检查 API 账户额度，稍后再试。");
                    if (status == 400 || status == 404) throw new InvalidOperationException("模型不可用或请求不受支持，请在连接设置中检查模型名称与账户权限。");
                    throw new InvalidOperationException("服务暂时不可用（HTTP " + status + "），请稍后重试。");
                }
                return Parse(body);
            }
        }
    }
    public string Parse(string body) {
        var root = json.Deserialize<Dictionary<string, object>>(body);
        object value;
        if (root.TryGetValue("status", out value) && Convert.ToString(value) != "completed")
            throw new InvalidOperationException("这次回复未完整生成，请缩短问题或重新发送。");
        StringBuilder result = new StringBuilder();
        if (root.TryGetValue("output", out value)) foreach (var item in (IEnumerable)value) {
            var obj = item as Dictionary<string, object>;
            if (obj == null || !obj.ContainsKey("content")) continue;
            foreach (var part in (IEnumerable)obj["content"]) {
                var p = part as Dictionary<string, object>;
                if (p == null || !p.ContainsKey("type")) continue;
                string type = Convert.ToString(p["type"]);
                if (type == "output_text" && p.ContainsKey("text")) result.Append(Convert.ToString(p["text"]));
                if (type == "refusal" && p.ContainsKey("refusal")) result.Append(Convert.ToString(p["refusal"]));
            }
        }
        if (result.Length == 0) throw new InvalidOperationException("服务没有返回文字，请换一个问题再试。");
        return result.ToString();
    }
    public void Dispose() { client.Dispose(); }
}
}
