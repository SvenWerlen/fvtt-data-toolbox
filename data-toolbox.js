/**
 * Adapted for PF1 system from original module: https://github.com/jopeek/fvtt-loot-sheet-npc-5e
 */ 

class GenerateCompendiumDialog extends FormApplication {
  
  constructor() {
    super()
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "Data Toolbox",
      classes: ["datatoolbox"],
      title: game.i18n.localize("tb.generateCompendiumTitle"),
      template: "modules/data-toolbox/templates/dialog-toolbox.html",
      buttons: {
        generate: {
          label: game.i18n.localize("tb.generate"),
          dontclose: true,
          callback: (html) => this._generate(html)
        },
        cancel: {
          label: game.i18n.localize("tb.cancel")
        },
      },
      width: 450,
      height: "auto",
      resizable: true,
      default: "generate",
      closeOnSubmit: false,
      submitOnClose: false,
      close: (dialog) => { }
    });
  }

  getData() {
    const types = CONST.COMPENDIUM_DOCUMENT_TYPES.map(documentName => {
      return { value: documentName, label: game.i18n.localize(getDocumentClass(documentName).metadata.label) };
    });
    game.i18n.sortObjects(types, "label");
    const folders = game.packs._formatFolderSelectOptions();

    return {
      source: game.settings.get("data-toolbox", "source"), 
      template: game.settings.get("data-toolbox", "template"),
      entitySelected: game.settings.get("data-toolbox", "entity"),
      compendium: game.settings.get("data-toolbox", "compendium"),
      types, folders, hasFolders: folders.length >= 1
    }
  }
  
  activateListeners(html) {
    super.activateListeners(html);
    
    // Detect and activate file-picker buttons
    html.find('button.file-picker').each((i, button) => this._activateFilePicker(button));

    // Generate
    html.find('button.generate').click(() => this._generate(html))

    // Cancel
    html.find('button.cancel').click(() => this.close())
  }
  
  _activateFilePicker(button) {
    button.onclick = event => {
      event.preventDefault();
      FilePicker.fromButton(button).browse();
    }
  }
  
  async _generate(html) {
    let source = html.find('input[name="source"]').val();
    let template = html.find('input[name="template"]').val();
    let entity = html.find('select[name="entity"]').val();
    let compendiumName = html.find('input[name="compendium"]').val();

    if (source.length == 0) {
      ui.notifications.error(game.i18n.localize("ERROR.tbNoSource"));
    }
    else if (template.length == 0) {
      ui.notifications.error(game.i18n.localize("ERROR.tbNoTemplate"));
    }
    else {
      game.settings.set("data-toolbox", "source", source);
      game.settings.set("data-toolbox", "template", template);
      game.settings.set("data-toolbox", "entity", entity);
      game.settings.set("data-toolbox", "compendium", compendiumName);
      
      if( !compendiumName || compendiumName.length == 0 ) {
        compendiumName = "Toolbox Data"
      }
      
      // load data (as CSV)
      let data;
      try {
        data = await d3.csv(source);
      } catch(err) {
        ui.notifications.error(game.i18n.localize("ERROR.tbInvalidCSV"));
        throw new Error(err);
      }
      
      // load template (as text)
      const tmpl = await d3.text(template);
      //console.log(tmpl)

      // valide CSV based on template
      let fields = new Set()
      let matches = tmpl.matchAll(/\{\{([^\}]+)\}\}/g)
      matches = Array.from(matches); 
      matches.forEach( m => fields.add(m[1]));
      let fieldIsNumber = {}
      let fieldDefault = {}
      let hasSample = false
      for (let i=0; i<data.length; i++) {
        let sample = i > 0 ? false : data[0][fields.values().next().value] === "sample"
        for (let f of fields.keys()) {
          if (f in fieldIsNumber) {
            // text mixed with numbers
            if (fieldIsNumber[f] && isNaN(data[i][f])) {
              ui.notifications.error(game.i18n.format("ERROR.tbNumberMixedWithText", {row: i+1, field: f}));
              let field = Object.keys(data[i]).indexOf(f)
              let f1Char = Math.floor(field / 26) == 0 ? "" : String.fromCharCode(65 + n)
              let f2Char = String.fromCharCode(65 + (field % 26))
              console.log(`Text found where Number should be: '${data[i][f]}' for field '${f}' (${f1Char}${f2Char}) on row ${i+2}`)
              console.log("If column number doesn't match your file, it means that you have 2 columns with the same name (one got ignored)")
              return;
            }
            // numbers but with text
          } else if(data[i][f] != null && data[i][f].length > 0) {
            fieldIsNumber[f] = !isNaN(data[i][f])
          }
          if (sample) {
            hasSample = true
            fieldDefault[f] = isNaN(data[i][f]) ? data[i][f] : Number(data[i][f])
          }
        }
      }
      
      const totalCount = hasSample ? data.length - 1 : data.length
      
      // delete compendium if exists
      const compendiumFilename = compendiumName.slugify({strict: true})
      let compendium = game.packs.get("world." + compendiumFilename);
      if (compendium) {
        await compendium.deleteCompendium()
      }
      
      // create new compendium
      compendium = await CompendiumCollection.createCompendium({label: compendiumName, type: entity})
      const pack = await game.packs.find(p => p.metadata.label === compendiumName);
      if (!pack) { return; }
      
      //console.log(fieldDefault)
      
      let jsonData = null;
      try {
        ui.notifications.info(game.i18n.localize("tb.processStarted"))
        for(let i=0; i<data.length; i++) {
          
          if (data[i].name === "sample" ) {
            continue;
          }
          
          if (i % 250 == 0 && i != 0) {
            ui.notifications.info(game.i18n.format("tb.inProcess", {count: i, total: totalCount}));
          }
          
          // replace empty values with default value (or 0s) and clean data
          for (let f of fields.keys()) {
            if (data[i][f] == null || data[i][f].length == 0) {
              if (f in fieldDefault) {
                data[i][f] = fieldDefault[f];
              }
              else if (fieldIsNumber[f]) {
                data[i][f] = 0;
              }
            }
            else {
              data[i][f] = data[i][f].replace(/\n/g, "\\n").replace(/\r/g, "").replace(/\"/g, "\\\"") //JSON.stringify(data[i][f])
            }
          }
          //console.log(data[i])
          
          jsonData = this.format(tmpl, data[i]);
          //console.log(jsonData)
          let newData = JSON.parse(jsonData)
          //console.log(newData)
          let entity = await pack.documentClass.create(newData, { pack: pack.collection });
          entity.update({}); // force update to auto-calculate other data (e.g. totals)
        }
        ui.notifications.info(game.i18n.format("tb.processCompleted", {count: totalCount, type: entity}));

        // open generated compendium
        compendium.render(true)
      } catch(err) {
        ui.notifications.error(game.i18n.localize("ERROR.tbGenerationError"));
        console.log("Data Toolbox | JSON: " + jsonData);
        throw new Error(err);
      }
    }
  }
  
  format(text, data={}) {
    const fmt = /\{\{[^\}]+\}\}/g;
    text = text.replace(fmt, k => {
      return data[k.slice(2, -2)];
    });
    return text;
  }
}


Hooks.once("init", () => {

  console.log("Data Toolbox | Init")
  loadTemplates(["modules/data-toolbox/templates/dialog-toolbox.html"]);
  
  game.settings.register("data-toolbox", "source", { scope: "world", config: false, type: String, default: "modules/data-toolbox/samples/bestiary-sample.csv" });
  game.settings.register("data-toolbox", "template", { scope: "world", config: false, type: String, default: "modules/data-toolbox/samples/creature-template.json" });
  game.settings.register("data-toolbox", "entity", { scope: "world", config: false, type: String, default: "Actor" });
  game.settings.register("data-toolbox", "compendium", { scope: "world", config: false, type: String, default: "" });
});


function dtShowToolbox() {
  console.log("Data Toolbox | Show");
  new GenerateCompendiumDialog().render(true);
}
