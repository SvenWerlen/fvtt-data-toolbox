
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
  
  static lastSelectedInitiative = 0
  static lastAuthor = ""
  
  constructor(hook, type, query) {
    Hooks.on(hook, this.handle.bind(this));
    this.type = type;
  }

  
  handle(app, html, data) {

    // only actors of type npc (bestiary) supported
    if( app.entity.entity == "Actor" && app.entity.data.type != "npc" ) { return; }
    // if not editable, it means that it wasn't modified (compendium)
    if( !app.isEditable ) { return; }
    // special case for JournalEntry
    if( app.entity.entity == "JournalEntry" ) {
      app.entity.data.type = "journal"
    }
    
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
      let match = await LetsContribute.getSearchEntryFromName(entity.name, this.type)
      
      if(!match) {
        ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"))
        return
      }
      
      new LetsContributeSubmit({ entity: entity, compendium: match.compendium, system: game.system }).render(true);

    }, false);
  }
  
  /**
   * Returns the entity matching the given name by searching in all compendiums
   * @return { entity, compendium } or null if not found
   */
  static async getSearchEntryFromName(entityName, entity) {
    console.log(entity)
    let packs = game.packs.entries
    let match = null
    let compendium = null
    for(let p=0; p<packs.length; p++) {
      if(packs[p].entity !== entity) continue;
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
   * Returns the entity based on the give type
   */
  static getEntityFromType(type) {
    switch(type) {
      case "npc": return "Actor"
      case "journal": return "JournalEntry"
      default: return "Item"
    }
  }
  
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

/*************************
 * SUBMIT  
 *************************/
class LetsContributeSubmit extends FormApplication {
  
  constructor(data) {
    super()
    this.data = data;
    if (typeof(Storage) !== "undefined") {
      this.data.selInitiative = localStorage.dtlcLastInitiative ? Number(localStorage.dtlcLastInitiative) : 0
      this.data.author = localStorage.dtlcAuthor ? localStorage.dtlcAuthor : ""
    } else {
      this.data.selInitiative = LetsContribute.lastSelectedInitiative;
      this.data.author = LetsContribute.lastAuthor;
    }
    
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributesubmit",
      classes: ["dtb", "submit"],
      title: game.i18n.localize("tblc.submitTitle"),
      template: "modules/data-toolbox/templates/letscontribute/submit.html",
      width: 600,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    // retrieve initiatives
    if(!this.data.initiatives) {
      let client = new LetsContributeClient()
      const response = await client.get('/initiatives/' + this.data.compendium.collection)
      if (!response || response.status != 200) {                  
        console.log("Error during submit: ", response ? response : "server unreachable")
        let code = response ? response.status : game.i18n.localize("ERROR.tlbcServerUnreachable")
        ui.notifications.error(game.i18n.format("tblc.msgInitiativesError", { code: code}));
      } else {
        this.data.initiatives = response.data
      }
    }
    // append additional details
    let selInitiative = null
    this.data.initiatives.forEach( i => { if(i.id == this.data.selInitiative) { selInitiative = i; return; } } );
    if(selInitiative) {
      this.data.initiativeDescription = selInitiative.description
      this.data.initiativeWarning = ""
    } else {
      this.data.initiativeDescription = game.i18n.localize("tblc.noInitiativeDescription")
      this.data.initiativeWarning = "warning"
    }
    return this.data
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".dialog-button").click(this._onControl.bind(this));
    html.find(".initiative").change(this._onControl.bind(this));
    html.find(".author").change(this._onControl.bind(this));
  }
  
  async _onControl(event) {
    event.preventDefault();
    const source = event.currentTarget;
    if (source.classList.contains("dialog-button")) {
      let data = {
        compendium: this.data.compendium.collection,
        system: this.data.system.id,
        entity: this.data.entity
      }
      if(this.data.selInitiative > 0) {
        data.initiative = Number(this.data.selInitiative)
      }
      if(this.data.author.length > 0) {
        data.author = this.data.author
      }
      // keep choices in storage
      if (typeof(Storage) !== "undefined") {
        localStorage.dtlcLastInitiative = data.initiative ? data.initiative : 0
        localStorage.dtlcAuthor = this.data.author
      } else {
        LetsContribute.lastSelectedInitiative = data.initiative ? data.initiative : 0
        LetsContribute.lastAuthor = this.data.author
      }
      // submit data
      let client = new LetsContributeClient()
      const response = await client.post('/item', data)
      if (response && response.status == 200) {                  
        ui.notifications.info(game.i18n.format("tblc.msgSubmitSuccess", { entryName: this.data.entity.name}));
      }
      else if(response && response.status == 403) {
        this.data.noReviewer = true
        this.render()
        return
      }
      else {
        console.log("Error during submit: ", response ? response : "server unreachable")
        let code = response ? response.status : game.i18n.localize("ERROR.tlbcServerUnreachable")
        ui.notifications.error(game.i18n.format("tblc.msgSubmitError", { entryName: this.data.entity.name, code: code}));
      }
      this.close()
    }  
    else if (source.classList.contains("initiative")) {
      console.log("Item in list changed")
      this.data.selInitiative = source.options[source.selectedIndex].value
      this.render()
    }
    else if (source.classList.contains("author")) {
      this.data.author = source.value
    }
  }
}


/*************************
 * REVIEW  
 *************************/
class LetsContributeReview extends FormApplication {
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["dtb", "review"],
      title: game.i18n.localize("tblc.reviewTitle"),
      template: "modules/data-toolbox/templates/letscontribute/review.html",
      width: 1100,
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
    const initiativeId = a.closest(".item").dataset.initiative;
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
        let match = await LetsContribute.getSearchEntryFromName(data.name, LetsContribute.getEntityFromType(data.type))
        if( !match ) {
          ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"))
          return
        }
        // retrieve initiative (if any)
        let filter = null
        if(initiativeId) {
          const response = await client.get('/initiatives/' + match.compendium.collection)
          if (response && response.status == 200) {
            response.data.forEach( i => { if(i.id == initiativeId) { filter = i.paths } })
          }
        }
        // prepare the data to compare
        const source = await match.compendium.getEntity(match.entity._id)
        let left = duplicate(data)
        delete left._id;
        let right = duplicate(source.data)
        delete right._id
        if(data.type == "journal") { delete left.type }
        // filter data if initiative specified
        if(filter && filter.length > 0) {
          let filterObj = {}
          filter.split(',').forEach( f => { filterObj[f] = "" })
          filterObj = expandObject(filterObj)
          left = filterObject(left, filterObj)
          right = filterObject(right, filterObj)
        }
        
        new LetsContributeCompare({ entry: left, source: right}).render(true)
      } else {
        console.log("Data Toolbox | Unexpected response", response)
        ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
      }
    }
    else if (a.classList.contains("import")) {
      let response = await client.get(`/item/${entryId}`)
      if( response.status == 200 ) {
        let objectToCreate = null
        // prepare data to import
        ui.notifications.info(game.i18n.localize("tblc.msgSearchingInCompendium"))
        let data = response.data
        let match = await LetsContribute.getSearchEntryFromName(data.name, LetsContribute.getEntityFromType(data.type))
        if( !match ) {
          ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"))
          return
        }
        if(data.type == "journal") { delete data.type }
        let source = await match.compendium.getEntity(match.entity._id)
        source = duplicate(source.data)
        delete source._id
        
        // retrieve initiative (if any)
        let filter = null
        if(initiativeId) {
          const response = await client.get('/initiatives/' + match.compendium.collection)
          if (response && response.status == 200) {
            response.data.forEach( i => { if(i.id == initiativeId) { filter = i.paths } })
          }
          
        }
        
        if(filter && filter.length > 0) {
          let filterObj = {}
          filter.split(',').forEach( f => { filterObj[f] = "" } )
          filterObj = expandObject(filterObj)
          let contribution = filterObject(response.data, filterObj)
          objectToCreate = mergeObject(source, contribution)
        } else {
          objectToCreate = duplicate( response.data );
          if( objectToCreate._id ) { delete objectToCreate._id; }
        }
        await Item.create(objectToCreate)
        ui.notifications.info(game.i18n.format("tblc.msgImportSuccess", { entryName: objectToCreate.name}));
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


/*************************
 * COMPARE  
 *************************/
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
  LetsContribute.getSheets(CONFIG.Actor).forEach(sheetClass => new LetsContribute(`render${sheetClass}`, 'Actor'));
  new LetsContribute(`renderJournalSheet`, 'JournalEntry');
});
