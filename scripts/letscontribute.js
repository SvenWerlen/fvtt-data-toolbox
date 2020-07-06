


/**
 * Add an icon on each item...
 */
class LetsContribute {

  static SERVER_URL = "http://127.0.0.1:5000"
  
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
      
      // retrieve pack entry matching name (there is not referenced ID?)
      ui.notifications.info(`Recherche de l'entrée... veuillez patienter!`)
      let match = await LetsContribute.getSearchEntryFromName(data.entity.name)
      
      if(!match) {
        ui.notifications.error(`Aucune entrée n'a été trouvée dans les compendium!`)
        return
      }
        
      renderTemplate("modules/data-toolbox/templates/letscontribute/submit.html", { 
          entity: data.entity, 
          compendium: match.compendium, 
          system: game.system
      }).then(dlg => {
        new Dialog({
          title: "Contribuer",
          content: dlg,
          buttons: {
            submit: {
              label: "Soumettre", 
              callback: async function(html) {
                data = {
                  compendium: match.compendium.collection,
                  system: game.system.id,
                  entity: data.entity
                }
                const response = await fetch(`${LetsContribute.SERVER_URL}/item`, {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(data)
                }).catch(function() {
                  ui.notifications.error(`${data.entity.name} n'a pas pu être soumis (connexion avec le serveur a échoué)!`)
                });
                if (response.status == 200) {
                  ui.notifications.info(`${data.entity.name} a été soumis avec succès!`)
                } else {
                  ui.notifications.error(`${data.entity.name} n'a pas pu être soumis (${response.status})!`)
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
    const entries = await fetch(`${LetsContribute.SERVER_URL}/items`).then(r => r.json()) 
    new LetsContributeReview(entries).render(true)
  }
};


class LetsContributeReview extends FormApplication {
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributereview",
      classes: ["dtb", "review"],
      title: "Review",
      template: "modules/data-toolbox/templates/letscontribute/review.html",
      width: 600,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  getData() {
    return {
      entries: this.object,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".controls a").click(this._onControl.bind(this));
  }
  
  async _onControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const entryId = a.closest(".item").dataset.entry;
    
    if (a.classList.contains("compare")) {
      let data = await fetch(`${LetsContribute.SERVER_URL}/item/${entryId}`).then(r => r.json())
      ui.notifications.info(`Recherche de l'entrée... veuillez patienter!`)
      let match = await LetsContribute.getSearchEntryFromName(data.name)
      if( !match ) {
        ui.notifications.error(`Référence non-trouvée dans vos compendiums!`)
      }
      const source = await match.compendium.getEntity(match.entity._id)
      new LetsContributeCompare({ entry: data.data, source: source.data.data}).render(true)
    }
    else if (a.classList.contains("import")) {
      console.log("here2")
    }
    else if (a.classList.contains("delete")) {
      console.log("here3")
    }
    //this.render();
  }
}


class LetsContributeCompare extends FormApplication {
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "letscontributecompare",
      classes: ["dtb", "compare"],
      title: "Review",
      template: "modules/data-toolbox/templates/letscontribute/compare.html",
      width: 1000,
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
    console.log(JSON.stringify(left))
    console.log(JSON.stringify(right))
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
