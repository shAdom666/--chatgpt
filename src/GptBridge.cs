using System;
using System.Collections;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
namespace GPTPet {
class GptBridge {
    public static int Main() {
        Console.InputEncoding = Encoding.UTF8; Console.OutputEncoding = new UTF8Encoding(false);
        var json = new JavaScriptSerializer { MaxJsonLength = 2000000 };
        try {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            string line = Console.ReadLine();
            if (line == null || line.Length > 200000) throw new ArgumentException("请求过长。");
            var request = json.Deserialize<Dictionary<string, object>>(line);
            string op = Convert.ToString(request["op"]);
            var config = Settings.Load();
            if (op == "config") {
                Console.WriteLine(json.Serialize(new { ok=true, model=config.Model, configured=!String.IsNullOrWhiteSpace(config.Key) }));
            } else if (op == "save") {
                string key = Convert.ToString(request["key"]), model = Convert.ToString(request["model"]);
                // Empty means keep existing; deleting is a separate explicit op.
                config.Save(String.IsNullOrWhiteSpace(key) ? config.Key : key, model);
                Console.WriteLine(json.Serialize(new { ok=true, model=config.Model, configured=!String.IsNullOrWhiteSpace(config.Key) }));
            } else if (op == "clear-key") {
                config.Save("",config.Model); Console.WriteLine("{\"ok\":true}");
            } else if (op == "reply") {
                string text = Convert.ToString(request["text"]).Trim();
                if (text.Length == 0 || text.Length > 8000) throw new ArgumentException("请输入 1～8000 字的消息。");
                var history = new List<Turn>(); object items;
                if (request.TryGetValue("history",out items)) foreach (var item in (IEnumerable)items) {
                    var obj = item as Dictionary<string,object>; if (obj == null) continue;
                    string role=Convert.ToString(obj["role"]), content=Convert.ToString(obj["content"]);
                    if ((role=="user" || role=="assistant") && content.Length <= 30000) history.Add(new Turn(role,content));
                }
                using (var api = new GptClient()) {
                    string reply = api.ReplyAsync(config.Key,config.Model,history,text,CancellationToken.None).GetAwaiter().GetResult();
                    Console.WriteLine(json.Serialize(new {ok=true,text=reply,model=config.Model}));
                }
            } else throw new ArgumentException("不支持的请求。");
            return 0;
        } catch (Exception e) {
            string message = e is ArgumentException || e is InvalidOperationException ? e.Message : "连接未成功，请检查网络和 API 设置。";
            Console.WriteLine(json.Serialize(new {ok=false,error=message})); return 1;
        }
    }
}
}
