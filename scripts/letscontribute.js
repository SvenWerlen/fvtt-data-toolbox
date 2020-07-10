
/**
 * Client functions for communicating with server
 */
class LetsContributeClient {
  
  //static SERVER_URL = "http://127.0.0.1:5000"
  static SERVER_URL = "https://boisdechet.org/fvtt"
  static HEADERS = { 'Accept': 'application/json', 'Content-Type': 'application/json' }
  
  token = null
  
  /*
   * Sends a request to server and return the response or null (if server unreachable)
   */
  async send(URI, method, data) {
    let params = {
      method: method,
      headers: LetsContributeClient.HEADERS
    }
    if( this.token ) { params.headers.Authorization = `Bearer ${this.token}`}
    if( data ) { params.body = JSON.stringify(data) }

    const response = await fetch(`${LetsContributeClient.SERVER_URL}${URI}`, params).catch(function(e) {
      console.log(`LetsContribute | Cannot establish connection to server ${LetsContributeClient.SERVER_URL}`, e)
    });
    if(!response) {
      return null;
    }
    return { 'status': response.status, 'data': await response.json() }
  }
  
  async get(URI) { return this.send(URI, "GET") }
  async put(URI) { return this.send(URI, "PUT") }
  async post(URI, data) { return this.send(URI, "POST", data) }
  async delete(URI, data) { return this.send(URI, "DELETE") }
  
  /*
   * User login
   */
  async login() {
    const login = game.settings.get("data-toolbox", "lcLogin")
    const accessKey = game.settings.get("data-toolbox", "lcAccessKey")
    if( !login || !accessKey ) {
      return false
    }
    let data = {
      login: login,
      secret: accessKey
    }
    const response = await this.post('/login', data)
    if( !response || response.status == 401 ) {
      return false
    }
    
    this.token = response.data.access_token
    return true
  }
    
}


/**
 * Add an icon on each item...
 */
class LetsContribute {
  
  constructor(hook, type, query) {
    Hooks.on(hook, this.handle.bind(this));
    this.type = type;
  }

  
  handle(app, html, data) {

    const handle = $(
        `<div class="window-upload-handle">
            <i class="fas fa-upload"></i>
        </div>`
    );

    const header = html.find(".window-header");
    header.after(handle);
    
    const img = handle.find('i')[0];
    img.addEventListener('click', async evt => {
      evt.stopPropagation();
      
      const entity = app.entity.data
      
      // retrieve pack entry matching name (there is not referenced ID?)
      ui.notifications.info(game.i18n.localize("tblc.msgSearchingInCompendium"))
      let match = await LetsContribute.getSearchEntryFromName(entity.name)
      
      if(!match) {
        ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"))
        return
      }
      
      renderTemplate("modules/data-toolbox/templates/letscontribute/submit.html", { 
          entity: entity, 
          compendium: match.compendium, 
          system: game.system
      }).then(dlg => {
        new Dialog({
          title: game.i18n.localize("tblc.submitTitle"),
          content: dlg,
          buttons: {
            submit: {
              label: game.i18n.localize("tblc.understandAndSubmit"), 
              callback: async function(html) {
                data = {
                  compendium: match.compendium.collection,
                  system: game.system.id,
                  entity: entity
                }
                let client = new LetsContributeClient()
                const response = await client.post('/item', data)
                if (response && response.status == 200) {                  
                  ui.notifications.info(game.i18n.format("tblc.msgSubmitSuccess", { entryName: entity.name}));
                } else {
                  console.log("Error during submit: ", response ? response : "server unreachable")
                  let code = response ? response.status : game.i18n.localize("ERROR.tlbcServerUnreachable")
                  ui.notifications.error(game.i18n.format("tblc.msgSubmitError", { entryName: entity.name, code: code}));
                }
              }
            }
          }
        }, { width: 600 }).render(true);
      });
    }, false);
  }
  
  /**
   * Returns the entity matching the given name by searching in all compendiums
   * @return { entity, compendium } or null if not found
   */
  static async getSearchEntryFromName(entityName) {
    let packs = game.packs.entries
    let match = null
    let compendium = null
    for(let p=0; p<packs.length; p++) {
      if(packs[p].entity !== "Item") continue;
      const index = await packs[p].getIndex()
      match = await index.find(e => e.name === entityName)
      if(match) {
        compendium = packs[p]
        break;
      }
    }
    if( match ) {
      return { entity: match, compendium: compendium }
    } else {
      return null;
    }
  };
  
  /**
   * Returns all sheets of given entity type (ex: item, actor, etc.)
   */
  static getSheets(entityType) {
    let sheetClasses = [];
    const entities = Object.values(entityType.sheetClasses);
    for (let entity of entities) {
        const entitySheets = Object.values(entity);
        for (let sheet of entitySheets) {
            const sheetClass = sheet.id.split(".")[1];
            if(!sheetClasses.includes(sheetClass)) {
                sheetClasses.push(sheetClass);
            }
        }
    }
    return sheetClasses;
  };
  
  static async showReviewerUI() {
    new LetsContributeReview().render(true)
  }
};


class LetsContributeReview extends FormApplication {
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["dtb", "review"],
      title: game.i18n.localize("tblc.reviewTitle"),
      template: "modules/data-toolbox/templates/letscontribute/review.html",
      width: 700,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    if (!game.user.isGM) {
      return { error: game.i18n.localize("ERROR.tlbcGMOnly") }
    }
    if (!game.settings.get("data-toolbox", "lcLogin") || !game.settings.get("data-toolbox", "lcAccessKey")) {
      return { error: game.i18n.localize("ERROR.tlbcConfigurationMissing") }
    }
    
    let client = new LetsContributeClient()
    if( ! await client.login() ) {
      return { error: game.i18n.localize("ERROR.tlbcNoRights") }
    }
    const response = await client.get('/items')
    if( response && response.status == 200 ) {
      return { entries: response.data };
    }
    return { error: game.i18n.localize("ERROR.tlbcServerUnreachable") }
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".controls a").click(this._onControl.bind(this));
  }
  
  async _onControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const entryId = a.closest(".item").dataset.entry;
    const entryName = a.closest(".item").dataset.name;
    const window = this
    
    // authentification required!
    let client = new LetsContributeClient()
    if(! await client.login()) {
      return;
    }
    
    if (a.classList.contains("compare")) {
      let response = await client.get(`/item/${entryId}`)
      if( response.status == 200 ) {
        ui.notifications.info(game.i18n.localize("tblc.msgSearchingInCompendium"))
        let data = response.data
        let match = await LetsContribute.getSearchEntryFromName(data.name)
        if( !match ) {
          ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"))
          return
        }
        const source = await match.compendium.getEntity(match.entity._id)
        new LetsContributeCompare({ entry: data.data, source: source.data.data}).render(true)
      } else {
        console.log("Data Toolbox | Unexpected response", response)
        ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
      }
    }
    else if (a.classList.contains("import")) {
      let response = await client.get(`/item/${entryId}`)
      if( response.status == 200 ) {
        if( response.data._id ) { delete response.data._id; }
        console.log(response.data)
        response.data.name = "Test"
        await Item.create(response.data)
        ui.notifications.info(game.i18n.format("tblc.msgImportSuccess", { entryName: response.data.name}));
      } else {
        console.log("Data Toolbox | Unexpected response", response)
        ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
      }
    }
    else if (a.classList.contains("delete")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.deleteTitle"),
        content: game.i18n.format("tblc.deleteContent", { name: entryName}),
        yes: async function() {
          let response = await client.delete(`/item/${entryId}`)
          if( response && response.status == 200 ) {
            window.render()
          } else {
            console.log("Data Toolbox | Unexpected response", response)
            ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
          }
        },
        no: () => {}
      });
    }
    else if (a.classList.contains("accept")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.acceptTitle"),
        content: game.i18n.format("tblc.acceptContent", { name: entryName}),
        yes: async function() {
          let response = await client.put(`/item/${entryId}/accept`)
          if( response && response.status == 200 ) {
            window.render()
          } else {
            console.log("Data Toolbox | Unexpected response", response)
            ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
          }
        },
        no: () => {}
      });
    }
    else if (a.classList.contains("reject")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.rejectTitle"),
        content: game.i18n.format("tblc.rejectContent", { name: entryName}),
        yes: async function() {
          let response = await client.put(`/item/${entryId}/reject`)
          if( response && response.status == 200 ) {
            window.render()
          } else {
            console.log("Data Toolbox | Unexpected response", response)
            ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
          }
        },
        no: () => {}
      });
    }
  }
}


class LetsContributeCompare extends FormApplication {
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributecompare",
      classes: ["dtb", "compare"],
      title: game.i18n.localize("tblc.compareTitle"),
      template: "modules/data-toolbox/templates/letscontribute/compare.html",
      width: window.screen.availWidth > 1200 ? 1200 : window.screen.availWidth,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  getData() {}
  
  activateListeners(html) {
    super.activateListeners(html);
    let left = this.object.entry
    let right = this.object.source
    let pre = jdd.compare(
      left, 
      right
    );
    html.find("pre.left").replaceWith(pre[0])
    html.find("pre.right").replaceWith(pre[1])
  }

}

Hooks.once('ready', () => {
  LetsContribute.getSheets(CONFIG.Item).forEach(sheetClass => new LetsContribute(`render${sheetClass}`, 'Item'));
});
