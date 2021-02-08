
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
   * Returns the entity matching the given name by searching in all compendiums
   * @return { entity, compendium } or null if not found
   */
  static async findEntityInCompendium(compendiumName, entityName) {
    const pack = game.packs.get(compendiumName);
    if(!pack) { return null; }
    await pack.getIndex();
    return pack.index.find(e => e.name === entityName);
  };

  /**
   * Returns the entity matching the given name by searching in the specified compendium
   * @return { entity, compendium } or null if not found
   */
  static async getSearchEntryFromNameAndCompendium(entityName, compendiumName) {
    let compendium = game.packs.get(compendiumName);
    const index = await compendium.getIndex();
    let entityToEdit = await index.find(e => e.name == entityName);

    if(entityToEdit) {
      return { entity: entityToEdit, compendium: compendium };
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
    ui.notifications.info(game.i18n.localize("tblc.msgPreparingReviewUI"))
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
    html.find(".changeCompendium").click(this._onControl.bind(this));
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
    // use case : the retrieved entity is not from the correct compendium, so the user wants to specify which compendium to search in
    else if (source.classList.contains("changeCompendium")) {
      new LetsContributeChooseCompendium({entity: this.data.entity}).render(true);
      this.close();
    }
  }
}


/*************************
 * SUBMIT - CHOOSE COMPENDIUM  
 *************************/

class LetsContributeChooseCompendium extends FormApplication {
  
  constructor(data) {
    super()
    this.data = data;    
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributechoosecompendium",
      classes: ["dtb", "submit"],
      title: game.i18n.localize("tblc.chooseCompendiumTitle"),
      template: "modules/data-toolbox/templates/letscontribute/choose-compendium.html",
      width: 600,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }

  async getData() {
    //retrieve compendiums
    this.data.compendiums = [];
    for(let key of game.packs.keys()) {
      this.data.compendiums.push({key: key, label: game.packs.get(key).metadata.label});
    }

    this.data.compendiums.sort(function (a, b) {
      return a.label.localeCompare(b.label);
    });

    if(!this.data.selCompendium) {
      this.data.selCompendium = this.data.compendiums[0].key;
    }

    return this.data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".dialog-button").click(this._onControl.bind(this));
    html.find(".compendium").change(this._onControl.bind(this));
  }
  
  async _onControl(event) {
    event.preventDefault();
    const source = event.currentTarget;
    // user validate their compendium choice
    if (source.classList.contains("dialog-button")) {
      let match = await LetsContribute.getSearchEntryFromNameAndCompendium(this.data.entity.name, this.data.selCompendium);
      
      if(!match) {
        ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"));
        return;
      }

      new LetsContributeSubmit({ entity: this.data.entity, compendium: game.packs.get(this.data.selCompendium), system: game.system }).render(true);
      this.close();
    }
    // compendium selected changed
    else if (source.classList.contains("compendium")) {
      console.log("Compendium in list changed");
      this.data.selCompendium = source.options[source.selectedIndex].value;
      this.render();
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
    if( !this.useDataInCache && ! await client.login() ) {
      return { error: game.i18n.localize("ERROR.tlbcNoRights") }
    }
    if(!this.cache) this.cache = {}
    if(!this.selected) this.selected = {}
    const response = this.useDataInCache ? this.cache["DATA"] : await client.get('/items')
    this.cache["DATA"] = response
    this.useDataInCache = false
    let allSelected = true
    let oneSelected = false
    if( response && response.status == 200 ) {
      for(let i = 0; i<response.data.length; i++) {
        const id = response.data[i].id
        const key = `${response.data[i].compendium}#${response.data[i].name}`
        response.data[i].selected = id in this.selected ? this.selected[id] : false
        if(!response.data[i].selected) allSelected = false // at least 1 entry is not selected => uncheck all selected box
        if(response.data[i].selected) oneSelected = true   // at least 1 entry is selected
        if( key in this.cache ) {
          response.data[i].found = this.cache[key]
        } else {
          console.log(`LetsContribute | Looking for ${response.data[i].name} in compendium ${response.data[i].compendium}`)
          let match = await LetsContribute.findEntityInCompendium(response.data[i].compendium, response.data[i].name)
          if(match) {
            response.data[i].found = true
          }
          this.cache[key] = match != null
        }
      }
      
      this.cache["ALLSELECTED"] = allSelected // keep all selected status in cache
      return { entries: response.data, allSelected : allSelected, batchStatus : oneSelected ? "" : "disabled" };
    }
    return { error: game.i18n.localize("ERROR.tlbcServerUnreachable") }
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".controls a").click(this._onControl.bind(this));
    html.find(".selected a").click(this._onSelect.bind(this));
    html.find(".actionsSelected button").click(this._onBatch.bind(this));        
  }
  
  async _onSelect(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const entryId = a.closest(".item").dataset.entry;
    if(entryId == "all") {
      this.cache["DATA"].data.forEach( el => this.selected[el.id] = !this.cache["ALLSELECTED"] )
    }
    else {
      this.selected[entryId] = entryId in this.selected ? !this.selected[entryId] : true
    }
    this.useDataInCache = true
    this.render()
  }
  
  async _onControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const entryId = a.closest(".item").dataset.entry;
    
    const entryName = a.closest(".item").dataset.name;
    let initiativeId = a.closest(".item").dataset.initiative;
    const window = this
    
    // authentification required!
    let client = new LetsContributeClient()
    if(! await client.login()) {
      return;
    }
    
    if (a.classList.contains("compare")) {
      let response = await client.get(`/item/${entryId}`)
      console.log(response)
      if( response.status == 200 ) {
        ui.notifications.info(game.i18n.localize("tblc.msgSearchingInCompendium"))
        let data = response.data
        let match = await LetsContribute.findEntityInCompendium(data.compendium, data.data.name)
        if( !match ) {
          ui.notifications.error(game.i18n.localize("ERROR.tlbcNoMatch"))
          return
        }
        // retrieve initiative (if any)
        let filter = null
        if(initiativeId) {
          const response = await client.get('/initiatives/' + data.compendium)
          if (response && response.status == 200) {
            response.data.forEach( i => { if(i.id == initiativeId) { filter = i.paths } })
          }
        }
        // prepare the data to compare
        const pack = game.packs.get(data.compendium);
        const source = await pack.getEntity(match._id)
        let left = duplicate(data.data)
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
        let match = await LetsContribute.findEntityInCompendium(data.compendium, data.data.name)
        if( !match ) {
          initiativeId = null
        }
        if(data.type == "journal") { delete data.type }
        
        // retrieve initiative (if any)
        let filter = null
        if(initiativeId) {
          const response = await client.get('/initiatives/' + data.compendium)
          if (response && response.status == 200) {
            response.data.forEach( i => { if(i.id == initiativeId) { filter = i.paths } })
          }
          
        }
        
        if(filter && filter.length > 0) {
          const pack = game.packs.get(data.compendium);
          const source = await pack.getEntity(match._id)
          source = duplicate(source.data)
          delete source._id
          let filterObj = {}
          filter.split(',').forEach( f => { filterObj[f] = "" } )
          filterObj = expandObject(filterObj)
          let contribution = filterObject(response.data.data, filterObj)
          objectToCreate = mergeObject(source, contribution)
        } else {
          objectToCreate = duplicate( response.data.data );
          if( objectToCreate._id ) { delete objectToCreate._id; }
        }
        await Item.create(objectToCreate)
        ui.notifications.info(game.i18n.format("tblc.msgImportSuccess", { entryName: objectToCreate.name}));
      } else {
        console.log("Data Toolbox | Unexpected response", response)
        ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
      }
    }
    else if (a.classList.contains("merge")) {
      let response = await client.get(`/item/${entryId}`)
      if( response.status == 200 ) {
        let objectToCreate = null
        // prepare data to import
        ui.notifications.info(game.i18n.localize("tblc.msgSearchingInCompendium"))
        let data = response.data
        const pack = game.packs.get(data.compendium);
        if(pack) {
          let objectToCreate = duplicate( response.data.data );
          if( objectToCreate._id ) { delete objectToCreate._id; }
          // create new item
          let item = await Item.create(objectToCreate)
          // import into compendium
          await pack.importEntity(item)
          // delete temporary item
          await item.delete()
          ui.notifications.info(game.i18n.format("tblc.msgImportSuccess", { entryName: objectToCreate.name}));
        } else {
          console.error("Data Toolbox | Invalid compendium", data.compendium)
        }
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
  
  async _onBatch(event) {
    event.preventDefault();
    const b = event.currentTarget;
    const data = this.cache["DATA"].data
    const selected = this.selected
    const window = this
    
    // authentification required!
    let client = new LetsContributeClient()
    if(! await client.login()) {
      return;
    }
    
    if (b.classList.contains("import")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.importAllTitle"),
        content: game.i18n.format("tblc.importAllContent"),
        yes: async function() {
          ui.notifications.info(game.i18n.localize("tblc.msgProcessing"))
          ui.sidebar.activateTab("items");
          for( let d of data) {
            if(d.id in selected && selected[d.id]) {
              let response = await client.get(`/item/${d.id}`)
              if( response.status == 200 ) {
                let objectToCreate = null
                // prepare data to import
                let data = response.data
                let match = await LetsContribute.findEntityInCompendium(data.compendium, data.data.name)
                let initiativeId = match ? d.initiativeId : null
                
                if(data.type == "journal") { delete data.type }
                
                // retrieve initiative (if any)
                let filter = null
                if(initiativeId) {
                  const response = await client.get('/initiatives/' + data.compendium)
                  if (response && response.status == 200) {
                    const initiative = response.data.find( i => i.id == initiativeId )
                    if(initiative) filter = initiative.paths
                  }
                }
                
                // merge existing with submited based on initiative filters
                if(filter && filter.length > 0) {
                  const pack = game.packs.get(data.compendium);
                  const source = await pack.getEntity(match._id)
                  source = duplicate(source.data)
                  delete source._id
                  let filterObj = {}
                  filter.split(',').forEach( f => { filterObj[f] = "" } )
                  filterObj = expandObject(filterObj)
                  let contribution = filterObject(response.data.data, filterObj)
                  objectToCreate = mergeObject(source, contribution)
                } else {
                  objectToCreate = duplicate( response.data.data );
                  if( objectToCreate._id ) { delete objectToCreate._id; }
                }
                await Item.create(objectToCreate)
              } else {
                console.log(`Data Toolbox | Unexpected response for '${d.name}'`, response)
                  ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
              }
            }
          }
        },
        no: () => {}
      });
    } 
    else if (b.classList.contains("accept")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.acceptAllTitle"),
        content: game.i18n.format("tblc.acceptAllContent"),
        yes: async function() {
          ui.notifications.info(game.i18n.localize("tblc.msgProcessing"))
          for( let d of data) {
            if(d.id in selected && selected[d.id]) {
              console.log(`Data Toolbox | Accepting '${d.name}'`)
              let response = await client.put(`/item/${d.id}/accept`)
              if( !response || response.status != 200 ) {
                console.log(`Data Toolbox | Unexpected response for '${d.name}'`, response)
                ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
              }
            }
          }
          window.render()
        },
        no: () => {}
      });
    }
    else if (b.classList.contains("reject")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.rejectAllTitle"),
        content: game.i18n.format("tblc.rejectAllContent"),
        yes: async function() {
          ui.notifications.info(game.i18n.localize("tblc.msgProcessing"))
          for( let d of data) {
            if(d.id in selected && selected[d.id]) {
              console.log(`Data Toolbox | Rejecting '${d.name}'`)
              let response = await client.put(`/item/${d.id}/reject`)
              if( !response || response.status != 200 ) {
                console.log(`Data Toolbox | Unexpected response for '${d.name}'`, response)
                ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
              }
            }
          }
          window.render()
        },
        no: () => {}
      });
    }
    else if (b.classList.contains("delete")) {
      Dialog.confirm({
        title: game.i18n.localize("tblc.deleteAllTitle"),
        content: game.i18n.format("tblc.deleteAllContent"),
        yes: async function() {
          ui.notifications.info(game.i18n.localize("tblc.msgProcessing"))
          for( let d of data) {
            if(d.id in selected && selected[d.id]) {
              console.log(`Data Toolbox | Deleting '${d.name}'`)
              let response = await client.delete(`/item/${d.id}`)
              if( !response || response.status != 200 ) {
                console.log(`Data Toolbox | Unexpected response for '${d.name}'`, response)
                ui.notifications.error(game.i18n.localize("tblc.tlbcUnexpectedResponse"))
              }
            }
          }
          window.render()
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
