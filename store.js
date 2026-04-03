const fs = require("fs"),
  path = require("path"),
  { app } = require("electron");
class Store {
  constructor() {
    this.fp = path.join(app.getPath("userData"), "store.json");
  }
  _load() {
    try {
      return JSON.parse(fs.readFileSync(this.fp, "utf-8"));
    } catch (e) {
      return {};
    }
  }
  get(key) {
    return this._load()[key];
  }
  set(key, val) {
    const d = this._load();
    d[key] = val;
    fs.writeFileSync(this.fp, JSON.stringify(d, null, 2));
  }
}
module.exports = Store;
