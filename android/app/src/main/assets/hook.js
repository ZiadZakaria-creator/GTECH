// بيتحقن في صفحة اللوحة جوه التطبيق: تنزيل ملفات Excel و CSV بيتحفظ في "التنزيلات" بتاعة الموبايل
(function () {
  if (window.__gtechApp) return;
  window.__gtechApp = true;
  var blobs = {};
  var create = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    var url = create.call(URL, obj);
    if (obj instanceof Blob) blobs[url] = obj; // بنحتفظ بيه حتى لو الصفحة لغت الرابط بعد الضغط على طول
    return url;
  };
  function save(name, blob) {
    var fr = new FileReader();
    fr.onload = function () {
      var s = String(fr.result);
      GTECHApp.saveFile(name, blob.type || "application/octet-stream", s.slice(s.indexOf(",") + 1));
    };
    fr.readAsDataURL(blob);
  }
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.href || "";
    if (this.hasAttribute("download") && (href.indexOf("blob:") === 0 || href.indexOf("data:") === 0)) {
      var name = this.getAttribute("download") || "gtech-file";
      if (blobs[href]) save(name, blobs[href]);
      else fetch(href).then(function (r) { return r.blob(); }).then(function (b) { save(name, b); });
      return;
    }
    return click.call(this);
  };
})();
